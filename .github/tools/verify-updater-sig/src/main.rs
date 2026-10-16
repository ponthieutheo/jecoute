//! Vérifie une release de J’écoute avant publication, de la même façon que l'app installée le fera
//! (tauri-plugin-updater 2.x) :
//!
//! - `latest.json` est lu comme le lit le plugin : JSON strict (un BOM le rendrait illisible),
//!   version semver, `pub_date` au format RFC 3339, `url` et `signature` pour chaque plateforme ;
//! - chaque signature est vérifiée avec minisign-verify contre la clé publique de `tauri.conf.json`,
//!   sur le contenu du fichier désigné par l'url, cherché sous son nom (ASCII) dans le dossier donné ;
//! - si le fichier `<nom>.sig` est présent à côté, il doit contenir la même signature.
//!
//! Usage :
//!   verify-updater-sig <tauri.conf.json> <dossier> [--base-url <url>] [--require <plateforme>]...
//!
//! Code de sortie 0 si tout est valide, 1 sinon.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use base64::Engine;
use minisign_verify::{PublicKey, Signature};
use serde::Deserialize;

#[derive(Deserialize)]
struct Manifest {
    #[serde(alias = "name")]
    version: String,
    #[allow(dead_code)]
    notes: Option<String>,
    pub_date: Option<String>,
    platforms: BTreeMap<String, Platform>,
}

#[derive(Deserialize)]
struct Platform {
    url: url::Url,
    signature: String,
}

struct Args {
    tauri_conf: PathBuf,
    dir: PathBuf,
    base_url: Option<String>,
    require: Vec<String>,
}

fn parse_args() -> Result<Args, String> {
    let mut positional = Vec::new();
    let mut base_url = None;
    let mut require = Vec::new();
    let mut it = std::env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--base-url" => base_url = Some(it.next().ok_or("--base-url attend une valeur")?),
            "--require" => require.push(it.next().ok_or("--require attend une valeur")?),
            _ if arg.starts_with("--") => return Err(format!("option inconnue : {arg}")),
            _ => positional.push(PathBuf::from(arg)),
        }
    }
    if positional.len() != 2 {
        return Err(
            "usage : verify-updater-sig <tauri.conf.json> <dossier> [--base-url <url>] [--require <plateforme>]..."
                .into(),
        );
    }
    let dir = positional.pop().unwrap();
    let tauri_conf = positional.pop().unwrap();
    Ok(Args {
        tauri_conf,
        dir,
        base_url: base_url.map(|u| u.trim_end_matches('/').to_string()),
        require,
    })
}

/// Copie de `base64_to_string` du plugin : décodage strict, sans nettoyage.
fn base64_to_string(input: &str) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(input)
        .map_err(|e| format!("base64 invalide : {e}"))?;
    String::from_utf8(bytes).map_err(|_| "contenu base64 qui n'est pas de l'UTF-8".to_string())
}

/// Copie de `verify_signature` du plugin. Renvoie le commentaire de confiance de la signature.
fn verify_signature(data: &[u8], release_signature: &str, pub_key: &str) -> Result<String, String> {
    let public_key = PublicKey::decode(&base64_to_string(pub_key)?)
        .map_err(|e| format!("clé publique illisible : {e}"))?;
    let signature = Signature::decode(&base64_to_string(release_signature)?)
        .map_err(|e| format!("signature illisible : {e}"))?;
    public_key
        .verify(data, &signature, true)
        .map_err(|e| format!("signature refusée : {e}"))?;
    Ok(signature.trusted_comment().to_string())
}

fn is_ascii_file_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('.')
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_' || b == b'-')
}

fn check_platform(
    key: &str,
    platform: &Platform,
    dir: &Path,
    pub_key: &str,
    base_url: Option<&str>,
) -> Result<String, String> {
    let url = &platform.url;
    if url.scheme() != "https" {
        return Err(format!("url non https : {url}"));
    }
    let name = url
        .path_segments()
        .and_then(|mut segments| segments.next_back())
        .unwrap_or_default()
        .to_string();
    if !is_ascii_file_name(&name) {
        return Err(format!(
            "nom de fichier non ASCII ou vide dans l'url : {url} (attendu : lettres, chiffres, . _ -)"
        ));
    }
    if let Some(base) = base_url {
        let expected = format!("{base}/{name}");
        if url.as_str() != expected {
            return Err(format!("url inattendue : {url} (attendu : {expected})"));
        }
    }

    let path = dir.join(&name);
    let data = std::fs::read(&path).map_err(|e| format!("lecture de {}: {e}", path.display()))?;
    let trusted = verify_signature(&data, &platform.signature, pub_key)?;

    let sig_path = dir.join(format!("{name}.sig"));
    if sig_path.exists() {
        let on_disk = std::fs::read_to_string(&sig_path)
            .map_err(|e| format!("lecture de {}: {e}", sig_path.display()))?;
        if on_disk.trim_end() != platform.signature {
            return Err(format!(
                "{} ne contient pas la signature de latest.json",
                sig_path.display()
            ));
        }
    }

    Ok(format!(
        "{key}: {name} ({} octets) signature valide [{trusted}]",
        data.len()
    ))
}

fn run() -> Result<Vec<String>, Vec<String>> {
    let args = parse_args().map_err(|e| vec![e])?;
    let mut report = Vec::new();
    let mut errors = Vec::new();

    let conf_text = std::fs::read_to_string(&args.tauri_conf)
        .map_err(|e| vec![format!("lecture de {}: {e}", args.tauri_conf.display())])?;
    let conf: serde_json::Value = serde_json::from_str(&conf_text)
        .map_err(|e| vec![format!("{} illisible : {e}", args.tauri_conf.display())])?;
    let pub_key = conf
        .pointer("/plugins/updater/pubkey")
        .and_then(|v| v.as_str())
        .ok_or_else(|| vec!["plugins.updater.pubkey absent de tauri.conf.json".to_string()])?
        .to_string();
    let conf_version = conf
        .get("version")
        .and_then(|v| v.as_str())
        .ok_or_else(|| vec!["version absente de tauri.conf.json".to_string()])?
        .to_string();

    let manifest_path = args.dir.join("latest.json");
    let bytes = std::fs::read(&manifest_path)
        .map_err(|e| vec![format!("lecture de {}: {e}", manifest_path.display())])?;
    // Le plugin lit la réponse avec serde_json::from_slice : on fait pareil.
    let manifest: Manifest = serde_json::from_slice(&bytes)
        .map_err(|e| vec![format!("latest.json illisible par le plugin : {e}")])?;

    match semver::Version::parse(manifest.version.trim_start_matches('v')) {
        Ok(v) if v.to_string() == conf_version => {
            report.push(format!("version: {v} (identique à tauri.conf.json)"))
        }
        Ok(v) => errors.push(format!(
            "version {v} différente de celle de tauri.conf.json ({conf_version})"
        )),
        Err(e) => errors.push(format!("version invalide : {e}")),
    }

    match manifest.pub_date.as_deref() {
        Some(date) => {
            match time::OffsetDateTime::parse(date, &time::format_description::well_known::Rfc3339)
            {
                Ok(_) => report.push(format!("pub_date: {date} (RFC 3339 valide)")),
                Err(e) => errors.push(format!("pub_date invalide ({date}) : {e}")),
            }
        }
        None => errors.push("pub_date absente".to_string()),
    }

    for key in &args.require {
        if !manifest.platforms.contains_key(key) {
            errors.push(format!(
                "plateforme attendue absente de latest.json : {key}"
            ));
        }
    }
    if manifest.platforms.is_empty() {
        errors.push("aucune plateforme dans latest.json".to_string());
    }

    for (key, platform) in &manifest.platforms {
        match check_platform(key, platform, &args.dir, &pub_key, args.base_url.as_deref()) {
            Ok(line) => report.push(line),
            Err(e) => errors.push(format!("{key}: {e}")),
        }
    }

    if errors.is_empty() {
        Ok(report)
    } else {
        Err(errors)
    }
}

fn main() -> ExitCode {
    match run() {
        Ok(report) => {
            for line in report {
                println!("OK   {line}");
            }
            println!("Tout est valide.");
            ExitCode::SUCCESS
        }
        Err(errors) => {
            for line in errors {
                eprintln!("ERREUR {line}");
            }
            ExitCode::FAILURE
        }
    }
}
