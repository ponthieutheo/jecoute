//! Statistiques de dictée : un compteur à part de l'historique (qui est limité
//! et peut être vidé). Seulement des chiffres, jamais le texte : par jour (mots,
//! secondes parlées, dictées) et par appli et par jour (mots). Tout reste dans
//! `stats.db`, à côté de l'historique, sur cet ordinateur.
//!
//! Les calculs (comptage des mots, temps gagné face à 45 mots/min, vitesse,
//! jours d'affilée) sont adaptés de coucou
//! (`windows/src-tauri/src/flow/text.rs` et `flow/store.rs`).
//! Copyright (c) 2026 Louis Raillé (Louis-CFM / coucou), licence MIT.

use anyhow::Result;
use chrono::{DateTime, Duration, Local, NaiveDate, TimeZone, Utc};
use log::{debug, error, info, warn};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use rusqlite_migration::{Migrations, M};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

/// Base à part de l'historique : vider l'historique n'y touche jamais.
static MIGRATIONS: &[M] = &[M::up(
    "CREATE TABLE stats_jour (
        jour TEXT PRIMARY KEY,
        mots INTEGER NOT NULL DEFAULT 0,
        secondes REAL NOT NULL DEFAULT 0,
        dictees INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE stats_appli (
        appli TEXT PRIMARY KEY,
        nom TEXT NOT NULL
    );
    CREATE TABLE stats_appli_jour (
        jour TEXT NOT NULL,
        appli TEXT NOT NULL,
        mots INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (jour, appli)
    );
    CREATE TABLE stats_meta (
        cle TEXT PRIMARY KEY,
        valeur TEXT NOT NULL
    );",
)];

/// Événement envoyé à la fenêtre après chaque dictée comptée (ou remise à zéro).
pub const STATS_UPDATED_EVENT: &str = "stats-updated";

// ── Les chiffres ─────────────────────────────────────────────────────────────

/// Vitesse de frappe au clavier qui sert à calculer le temps gagné.
pub const TYPING_WORDS_PER_MINUTE: f64 = 45.0;

/// Idéogrammes et kana : des langues écrites sans espaces, où chaque signe
/// compte pour un mot (comme le font les traitements de texte).
fn is_cjk(c: char) -> bool {
    matches!(c as u32,
        0x3040..=0x30FF     // hiragana, katakana
        | 0x31F0..=0x31FF   // katakana, extensions phonétiques
        | 0x3400..=0x4DBF   // idéogrammes, extension A
        | 0x4E00..=0x9FFF   // idéogrammes unifiés
        | 0xF900..=0xFAFF   // idéogrammes de compatibilité
        | 0xFF66..=0xFF9F   // katakana demi-chasse
        | 0x20000..=0x3134F // idéogrammes, extensions B à G
    )
}

/// Les mots comme on les compte : « c'est », « aujourd’hui » et « rendez-vous »
/// font un mot, un « ? » ou un « — » isolé aucun ; en chinois et en japonais,
/// chaque idéogramme ou kana compte pour un.
pub fn word_count(text: &str) -> u64 {
    let mut count = 0;
    for token in text.split_whitespace() {
        let mut in_word = false;
        for c in token.chars() {
            if is_cjk(c) {
                if in_word {
                    count += 1;
                    in_word = false;
                }
                count += 1;
            } else if c.is_alphanumeric() {
                in_word = true;
            }
        }
        if in_word {
            count += 1;
        }
    }
    count
}

/// Mots par minute parlée (0 sous une seconde : rien à mesurer).
pub fn words_per_minute(words: u64, seconds: f64) -> u64 {
    if seconds < 1.0 || words == 0 {
        return 0;
    }
    (words as f64 / (seconds / 60.0)).round() as u64
}

/// Minutes gagnées : le temps qu'il aurait fallu pour taper les mots à
/// 45 mots/min, moins le temps passé à les dire. Jamais négatif.
pub fn minutes_saved(words: u64, seconds: f64) -> f64 {
    (words as f64 / TYPING_WORDS_PER_MINUTE - seconds / 60.0).max(0.0)
}

/// Le jour (dans le fuseau donné) d'un instant : une dictée à 23 h 59 compte
/// pour ce jour-là, celle de 0 h 01 pour le lendemain.
pub fn day_in<Tz: TimeZone>(instant: DateTime<Utc>, tz: &Tz) -> NaiveDate {
    instant.with_timezone(tz).date_naive()
}

/// Le jour local (fuseau de l'ordinateur) d'un instant.
pub fn local_day(instant: DateTime<Utc>) -> NaiveDate {
    day_in(instant, &Local)
}

/// Jours d'affilée avec au moins une dictée, en remontant depuis aujourd'hui
/// (ou depuis hier si aujourd'hui n'en a pas encore).
pub fn streak(days: &BTreeSet<NaiveDate>, today: NaiveDate) -> u32 {
    let mut day = today;
    if !days.contains(&day) {
        day -= Duration::days(1);
    }
    let mut count = 0;
    while days.contains(&day) {
        count += 1;
        day -= Duration::days(1);
    }
    count
}

fn key(day: NaiveDate) -> String {
    day.format("%Y-%m-%d").to_string()
}

fn parse_key(key: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(key, "%Y-%m-%d").ok()
}

// ── Ce que voit la page ──────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
pub struct DayStats {
    /// « 2026-10-19 », jour local.
    pub day: String,
    pub words: u64,
    pub seconds: f64,
    pub dictations: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
pub struct AppShare {
    /// Le .exe en minuscules (« windowsterminal »).
    pub app: String,
    /// Le nom montré (« Windows Terminal »).
    pub name: String,
    pub words: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, Type, PartialEq)]
pub struct PeriodStats {
    pub words: u64,
    pub seconds: f64,
    pub dictations: u64,
    pub words_per_minute: u64,
    pub minutes_saved: f64,
    /// Les applis de la période, de la plus utilisée à la moins utilisée.
    pub apps: Vec<AppShare>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
pub struct DictationStats {
    /// Aujourd'hui, jour local (« 2026-10-19 »).
    pub today: String,
    pub streak: u32,
    /// Les 7 derniers jours, aujourd'hui compris.
    pub week: PeriodStats,
    /// Les 30 derniers jours, aujourd'hui compris.
    pub month: PeriodStats,
    pub all: PeriodStats,
    /// Les jours où l'on a dicté, du plus ancien au plus récent.
    pub days: Vec<DayStats>,
}

/// Une ligne de `stats_appli_jour`.
#[derive(Clone, Debug)]
pub struct AppDay {
    pub day: NaiveDate,
    pub app: String,
    pub words: u64,
}

fn period(
    days: &[(NaiveDate, DayStats)],
    app_days: &[AppDay],
    names: &HashMap<String, String>,
    from: Option<NaiveDate>,
) -> PeriodStats {
    let keep = |d: &NaiveDate| from.is_none_or(|f| *d >= f);
    let mut out = PeriodStats::default();
    for (_, d) in days.iter().filter(|(day, _)| keep(day)) {
        out.words += d.words;
        out.seconds += d.seconds;
        out.dictations += d.dictations;
    }
    out.words_per_minute = words_per_minute(out.words, out.seconds);
    out.minutes_saved = minutes_saved(out.words, out.seconds);

    let mut per_app: BTreeMap<&str, u64> = BTreeMap::new();
    for a in app_days.iter().filter(|a| keep(&a.day)) {
        *per_app.entry(a.app.as_str()).or_default() += a.words;
    }
    let mut apps: Vec<AppShare> = per_app
        .into_iter()
        .filter(|(_, words)| *words > 0)
        .map(|(app, words)| AppShare {
            app: app.to_string(),
            name: names.get(app).cloned().unwrap_or_else(|| app.to_string()),
            words,
        })
        .collect();
    apps.sort_by(|a, b| b.words.cmp(&a.words).then_with(|| a.name.cmp(&b.name)));
    out.apps = apps;
    out
}

/// Tous les chiffres de la page, à partir des lignes de la base.
pub fn build_summary(
    days: Vec<DayStats>,
    app_days: &[AppDay],
    names: &HashMap<String, String>,
    today: NaiveDate,
) -> DictationStats {
    let mut dated: Vec<(NaiveDate, DayStats)> = days
        .into_iter()
        .filter_map(|d| parse_key(&d.day).map(|day| (day, d)))
        .collect();
    dated.sort_by_key(|(day, _)| *day);
    let active: BTreeSet<NaiveDate> = dated
        .iter()
        .filter(|(_, d)| d.words > 0)
        .map(|(day, _)| *day)
        .collect();
    DictationStats {
        today: key(today),
        streak: streak(&active, today),
        week: period(&dated, app_days, names, Some(today - Duration::days(6))),
        month: period(&dated, app_days, names, Some(today - Duration::days(29))),
        all: period(&dated, app_days, names, None),
        days: dated.into_iter().map(|(_, d)| d).collect(),
    }
}

// ── La base ──────────────────────────────────────────────────────────────────

/// Ce qu'on retient d'une dictée : des chiffres et le nom de l'appli.
#[derive(Clone, Debug)]
pub struct Dictation<'a> {
    pub words: u64,
    pub seconds: f64,
    pub day: NaiveDate,
    /// (id, nom) de l'appli au premier plan, si on la connaît.
    pub app: Option<(&'a str, &'a str)>,
}

fn add(conn: &Connection, d: &Dictation) -> rusqlite::Result<()> {
    let day = key(d.day);
    conn.execute(
        "INSERT INTO stats_jour (jour, mots, secondes, dictees) VALUES (?1, ?2, ?3, 1)
         ON CONFLICT(jour) DO UPDATE SET
            mots = mots + excluded.mots,
            secondes = secondes + excluded.secondes,
            dictees = dictees + 1",
        params![day, d.words as i64, d.seconds.max(0.0)],
    )?;
    if let Some((app, name)) = d.app.filter(|(app, _)| !app.is_empty()) {
        conn.execute(
            "INSERT INTO stats_appli (appli, nom) VALUES (?1, ?2)
             ON CONFLICT(appli) DO UPDATE SET nom = excluded.nom",
            params![app, name],
        )?;
        conn.execute(
            "INSERT INTO stats_appli_jour (jour, appli, mots) VALUES (?1, ?2, ?3)
             ON CONFLICT(jour, appli) DO UPDATE SET mots = mots + excluded.mots",
            params![day, app, d.words as i64],
        )?;
    }
    Ok(())
}

fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    Ok(conn)
}

/// Les dictées encore dans l'historique, pour amorcer les chiffres au premier
/// lancement de la version qui les compte. La durée vient du fichier audio
/// gardé avec chaque dictée ; sans lui, la dictée n'est pas reprise (une
/// vitesse sans durée serait fausse). L'appli n'est pas connue.
fn read_history(history_db: &Path, recordings_dir: &Path) -> Result<Vec<(NaiveDate, u64, f64)>> {
    if !history_db.exists() {
        return Ok(Vec::new());
    }
    let conn = Connection::open_with_flags(history_db, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let has_table: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='transcription_history'",
        [],
        |row| row.get(0),
    )?;
    if !has_table {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare(
        "SELECT timestamp, file_name, transcription_text, post_processed_text
         FROM transcription_history WHERE transcription_text != ''",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
        ))
    })?;
    let mut out = Vec::new();
    for row in rows {
        let (timestamp, file_name, raw, processed) = row?;
        let text = processed.filter(|p| !p.trim().is_empty()).unwrap_or(raw);
        let words = word_count(&text);
        if words == 0 {
            continue;
        }
        let Some(seconds) = wav_seconds(&recordings_dir.join(&file_name)) else {
            continue;
        };
        let Some(instant) = DateTime::from_timestamp(timestamp, 0) else {
            continue;
        };
        out.push((local_day(instant), words, seconds));
    }
    Ok(out)
}

fn wav_seconds(path: &Path) -> Option<f64> {
    let reader = hound::WavReader::open(path).ok()?;
    let spec = reader.spec();
    if spec.sample_rate == 0 {
        return None;
    }
    Some(reader.duration() as f64 / spec.sample_rate as f64)
}

pub struct StatsManager {
    app_handle: Option<AppHandle>,
    db_path: PathBuf,
    /// Une écriture à la fois.
    write: Mutex<()>,
}

impl StatsManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        let dir = crate::portable::app_data_dir(app_handle)?;
        std::fs::create_dir_all(&dir)?;
        let mut manager = Self::open_at(
            dir.join("stats.db"),
            Some((&dir.join("history.db"), &dir.join("recordings"))),
        )?;
        manager.app_handle = Some(app_handle.clone());
        Ok(manager)
    }

    /// Ouvre (ou crée) la base ; à la création, reprend l'historique s'il y en a un.
    pub fn open_at(db_path: PathBuf, history: Option<(&Path, &Path)>) -> Result<Self> {
        let mut conn = open(&db_path)?;
        let migrations = Migrations::new(MIGRATIONS.to_vec());
        #[cfg(debug_assertions)]
        migrations.validate().expect("Invalid stats migrations");
        migrations.to_latest(&mut conn)?;

        let manager = Self {
            app_handle: None,
            db_path,
            write: Mutex::new(()),
        };
        let seeded: Option<String> = conn
            .query_row(
                "SELECT valeur FROM stats_meta WHERE cle = 'amorce'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        if seeded.is_none() {
            let entries = match history {
                Some((db, recordings)) => read_history(db, recordings).unwrap_or_else(|e| {
                    warn!("Stats: could not read the history to seed them: {e}");
                    Vec::new()
                }),
                None => Vec::new(),
            };
            let tx = conn.transaction()?;
            for (day, words, seconds) in &entries {
                add(
                    &tx,
                    &Dictation {
                        words: *words,
                        seconds: *seconds,
                        day: *day,
                        app: None,
                    },
                )?;
            }
            tx.execute(
                "INSERT INTO stats_meta (cle, valeur) VALUES ('amorce', ?1)",
                params![entries.len().to_string()],
            )?;
            tx.commit()?;
            info!(
                "Stats: started, {} dictations taken from the history",
                entries.len()
            );
        }
        Ok(manager)
    }

    /// Compte une dictée réussie. Rien si le texte n'a aucun mot.
    pub fn record_at(
        &self,
        text: &str,
        seconds: f64,
        app: Option<(&str, &str)>,
        day: NaiveDate,
    ) -> Result<bool> {
        let words = word_count(text);
        if words == 0 {
            return Ok(false);
        }
        let _guard = self.write.lock().unwrap_or_else(|e| e.into_inner());
        let mut conn = open(&self.db_path)?;
        let tx = conn.transaction()?;
        add(
            &tx,
            &Dictation {
                words,
                seconds,
                day,
                app,
            },
        )?;
        tx.commit()?;
        debug!("Stats: +{words} words, {seconds:.1} s");
        Ok(true)
    }

    /// Compte une dictée du moment et prévient la fenêtre.
    pub fn record(&self, text: &str, seconds: f64, app: Option<(&str, &str)>) {
        match self.record_at(text, seconds, app, local_day(Utc::now())) {
            Ok(true) => self.notify(),
            Ok(false) => {}
            Err(e) => error!("Stats: could not count the dictation: {e}"),
        }
    }

    fn notify(&self) {
        if let Some(app) = &self.app_handle {
            let _ = app.emit(STATS_UPDATED_EVENT, ());
        }
    }

    pub fn summary_at(&self, today: NaiveDate) -> Result<DictationStats> {
        let conn = open(&self.db_path)?;
        let mut stmt =
            conn.prepare("SELECT jour, mots, secondes, dictees FROM stats_jour ORDER BY jour")?;
        let days = stmt
            .query_map([], |row| {
                Ok(DayStats {
                    day: row.get(0)?,
                    words: row.get::<_, i64>(1)?.max(0) as u64,
                    seconds: row.get(2)?,
                    dictations: row.get::<_, i64>(3)?.max(0) as u64,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut stmt = conn.prepare("SELECT jour, appli, mots FROM stats_appli_jour")?;
        let app_days = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?
            .into_iter()
            .filter_map(|(day, app, words)| {
                parse_key(&day).map(|day| AppDay {
                    day,
                    app,
                    words: words.max(0) as u64,
                })
            })
            .collect::<Vec<_>>();
        let mut stmt = conn.prepare("SELECT appli, nom FROM stats_appli")?;
        let names = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<rusqlite::Result<HashMap<String, String>>>()?;
        Ok(build_summary(days, &app_days, &names, today))
    }

    pub fn summary(&self) -> Result<DictationStats> {
        self.summary_at(local_day(Utc::now()))
    }

    /// Remet tous les chiffres à zéro (l'historique n'est pas touché, et il
    /// n'est pas repris ensuite).
    pub fn reset(&self) -> Result<()> {
        let _guard = self.write.lock().unwrap_or_else(|e| e.into_inner());
        let mut conn = open(&self.db_path)?;
        let tx = conn.transaction()?;
        tx.execute_batch(
            "DELETE FROM stats_jour; DELETE FROM stats_appli_jour; DELETE FROM stats_appli;",
        )?;
        tx.commit()?;
        info!("Stats: reset");
        self.notify();
        Ok(())
    }
}

// ── Durée parlée ─────────────────────────────────────────────────────────────

/// Début de l'enregistrement en cours : la durée parlée va du début de
/// l'enregistrement à l'arrêt demandé (comme chez coucou, le temps où l'on
/// tient la touche), pas la durée de l'audio gardé, que la détection de voix
/// raccourcit.
static RECORDING_STARTED: Mutex<Option<Instant>> = Mutex::new(None);

pub fn recording_started() {
    *RECORDING_STARTED.lock().unwrap_or_else(|e| e.into_inner()) = Some(Instant::now());
}

/// Secondes depuis `recording_started`, et l'oublie.
pub fn recording_stopped() -> Option<f64> {
    RECORDING_STARTED
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .map(|start| start.elapsed().as_secs_f64())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;

    fn d(s: &str) -> NaiveDate {
        parse_key(s).unwrap()
    }

    #[test]
    fn words_are_counted_like_people_count_them_in_french() {
        assert_eq!(word_count("C'est l’heure du rendez-vous !"), 4);
        assert_eq!(word_count("Aujourd’hui, j'ai dit : « bonjour » à tous."), 6);
        assert_eq!(word_count("  ? ! — … "), 0);
        assert_eq!(word_count("Il est 12 h 30, soit 100 % à l'heure"), 9);
        assert_eq!(word_count(""), 0);
        assert_eq!(word_count("week-end\tpeut-être\nlà-bas"), 3);
    }

    #[test]
    fn languages_without_spaces_count_each_sign() {
        assert_eq!(word_count("我们今天去北京"), 7);
        assert_eq!(word_count("今日は晴れです。"), 7);
        assert_eq!(word_count("我用Windows系统"), 5);
        assert_eq!(word_count("Hello 世界"), 3);
    }

    #[test]
    fn time_saved_and_speed() {
        // 450 mots en 1 min : 10 min au clavier, 1 min parlée → 9 min gagnées.
        assert!((minutes_saved(450, 60.0) - 9.0).abs() < 1e-9);
        // Jamais négatif.
        assert_eq!(minutes_saved(1, 600.0), 0.0);
        assert_eq!(minutes_saved(0, 0.0), 0.0);
        assert_eq!(words_per_minute(150, 60.0), 150);
        assert_eq!(words_per_minute(100, 45.0), 133);
        assert_eq!(words_per_minute(10, 0.5), 0);
        assert_eq!(words_per_minute(0, 30.0), 0);
    }

    #[test]
    fn days_follow_the_local_time_zone_across_midnight() {
        let paris_summer = FixedOffset::east_opt(2 * 3600).unwrap();
        // 21:59 UTC = 23:59 à Paris : encore le 19.
        let before = Utc.with_ymd_and_hms(2026, 10, 19, 21, 59, 0).unwrap();
        assert_eq!(day_in(before, &paris_summer), d("2026-10-19"));
        // 22:01 UTC = 00:01 à Paris : déjà le 20, alors qu'en UTC c'est le 19.
        let after = Utc.with_ymd_and_hms(2026, 10, 19, 22, 1, 0).unwrap();
        assert_eq!(day_in(after, &paris_summer), d("2026-10-20"));
        assert_eq!(day_in(after, &Utc), d("2026-10-19"));
        // À l'ouest, l'inverse : 03:00 UTC le 20 = 23:00 le 19 à New York.
        let new_york = FixedOffset::west_opt(4 * 3600).unwrap();
        let late = Utc.with_ymd_and_hms(2026, 10, 20, 3, 0, 0).unwrap();
        assert_eq!(day_in(late, &new_york), d("2026-10-19"));
    }

    #[test]
    fn the_streak_counts_days_in_a_row_until_today_or_yesterday() {
        let today = d("2026-10-19");
        let set = |keys: &[&str]| keys.iter().map(|k| d(k)).collect::<BTreeSet<_>>();
        assert_eq!(
            streak(&set(&["2026-10-19", "2026-10-18", "2026-10-16"]), today),
            2
        );
        assert_eq!(streak(&set(&["2026-10-18", "2026-10-17"]), today), 2);
        assert_eq!(streak(&set(&["2026-10-17"]), today), 0);
        assert_eq!(streak(&set(&[]), today), 0);
        // À travers un changement de mois et d'année.
        assert_eq!(
            streak(
                &set(&["2027-01-01", "2026-12-31", "2026-12-30"]),
                d("2027-01-01")
            ),
            3
        );
        // Passage à l'heure d'hiver (25/10) : les jours restent des jours.
        assert_eq!(
            streak(
                &set(&["2026-10-26", "2026-10-25", "2026-10-24"]),
                d("2026-10-26")
            ),
            3
        );
    }

    fn temp_db() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("stats.db");
        (dir, path)
    }

    #[test]
    fn dictations_are_counted_by_day_and_by_app() {
        let (_dir, path) = temp_db();
        let stats = StatsManager::open_at(path.clone(), None).unwrap();
        let today = d("2026-10-19");
        let term = Some(("windowsterminal", "Windows Terminal"));
        assert!(stats
            .record_at("Bonjour à tous, c'est parti.", 3.0, term, today)
            .unwrap());
        assert!(stats
            .record_at("Encore un mot", 2.0, Some(("chrome", "Chrome")), today)
            .unwrap());
        assert!(stats
            .record_at("Hier soir", 1.0, None, d("2026-10-18"))
            .unwrap());
        // Vide ou sans mot : ne compte pas.
        assert!(!stats.record_at("", 4.0, term, today).unwrap());
        assert!(!stats.record_at(" ? ", 4.0, term, today).unwrap());
        // Il y a 40 jours : seulement dans « tout ».
        stats
            .record_at("Très vieux texte", 2.0, term, d("2026-09-09"))
            .unwrap();

        let s = stats.summary_at(today).unwrap();
        assert_eq!(s.today, "2026-10-19");
        assert_eq!(s.streak, 2);
        assert_eq!(s.week.words, 5 + 3 + 2);
        assert_eq!(s.week.dictations, 3);
        assert!((s.week.seconds - 6.0).abs() < 1e-9);
        assert_eq!(s.all.words, 13);
        assert_eq!(s.all.dictations, 4);
        assert_eq!(s.week.apps.len(), 2);
        assert_eq!(s.week.apps[0].name, "Windows Terminal");
        assert_eq!(s.week.apps[0].words, 5);
        assert_eq!(s.all.apps[0].words, 8);
        assert_eq!(s.days.first().unwrap().day, "2026-09-09");
        assert_eq!(s.days.len(), 3);

        // Rouverte : tout est là.
        let again = StatsManager::open_at(path, None).unwrap();
        assert_eq!(again.summary_at(today).unwrap(), s);

        again.reset().unwrap();
        let empty = again.summary_at(today).unwrap();
        assert_eq!(empty.all, PeriodStats::default());
        assert!(empty.days.is_empty());
        assert_eq!(empty.streak, 0);
    }

    #[test]
    fn the_history_seeds_the_numbers_once() {
        let dir = tempfile::tempdir().unwrap();
        let history = dir.path().join("history.db");
        let recordings = dir.path().join("recordings");
        std::fs::create_dir_all(&recordings).unwrap();
        let conn = Connection::open(&history).unwrap();
        conn.execute_batch(
            "CREATE TABLE transcription_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                saved BOOLEAN NOT NULL DEFAULT 0,
                title TEXT NOT NULL,
                transcription_text TEXT NOT NULL,
                post_processed_text TEXT,
                post_process_prompt TEXT,
                post_process_requested BOOLEAN NOT NULL DEFAULT 0
            );",
        )
        .unwrap();
        let now = Utc::now().timestamp();
        let insert = |file: &str, text: &str, processed: Option<&str>| {
            conn.execute(
                "INSERT INTO transcription_history (file_name, timestamp, title, transcription_text, post_processed_text)
                 VALUES (?1, ?2, 't', ?3, ?4)",
                params![file, now, text, processed],
            )
            .unwrap();
        };
        // 2 s d'audio à 16 kHz.
        let wav = recordings.join("a.wav");
        crate::audio_toolkit::save_wav_file(&wav, &vec![0.0f32; 32_000]).unwrap();
        insert("a.wav", "un deux trois", Some("Un, deux, trois, quatre."));
        insert("a.wav", "cinq six", None);
        insert("absent.wav", "sans audio", None);
        insert("a.wav", "", None);
        drop(conn);

        let (_d, path) = temp_db();
        let stats = StatsManager::open_at(path.clone(), Some((&history, &recordings))).unwrap();
        let s = stats.summary_at(local_day(Utc::now())).unwrap();
        assert_eq!(s.all.words, 4 + 2);
        assert_eq!(s.all.dictations, 2);
        assert!((s.all.seconds - 4.0).abs() < 1e-6);
        assert!(s.all.apps.is_empty());

        // Une remise à zéro ne reprend pas l'historique au lancement suivant.
        stats.reset().unwrap();
        let again = StatsManager::open_at(path, Some((&history, &recordings))).unwrap();
        assert_eq!(
            again.summary_at(local_day(Utc::now())).unwrap().all.words,
            0
        );
    }
}
