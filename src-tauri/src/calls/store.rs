//! Recorded calls in SQLite (`calls.db` in the app's data folder, its own
//! file so its migrations never mix with the dictation history's). Only text
//! is kept: the audio is deleted once the transcript is written.

use std::path::Path;
use std::sync::Mutex;

use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension, Row};
use rusqlite_migration::{Migrations, M};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::transcript::{Line, Speaker, Todo};

static MIGRATIONS: &[M] = &[M::up(
    "CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        title_edited INTEGER NOT NULL DEFAULT 0,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        status TEXT NOT NULL,
        system_audio INTEGER NOT NULL DEFAULT 0,
        speakers TEXT NOT NULL DEFAULT '[]',
        lines TEXT NOT NULL DEFAULT '[]',
        summary TEXT,
        key_points TEXT NOT NULL DEFAULT '[]',
        todos TEXT NOT NULL DEFAULT '[]',
        summary_error TEXT,
        error TEXT
    );
    CREATE INDEX IF NOT EXISTS calls_started_at ON calls(started_at DESC);",
)];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum CallStatus {
    /// Being recorded (or left so by a crash: written at the next launch).
    Recording,
    /// The transcript is being written.
    Processing,
    Ready,
    Failed,
}

impl CallStatus {
    fn as_str(self) -> &'static str {
        match self {
            CallStatus::Recording => "recording",
            CallStatus::Processing => "processing",
            CallStatus::Ready => "ready",
            CallStatus::Failed => "failed",
        }
    }

    fn parse(s: &str) -> CallStatus {
        match s {
            "recording" => CallStatus::Recording,
            "processing" => CallStatus::Processing,
            "ready" => CallStatus::Ready,
            _ => CallStatus::Failed,
        }
    }
}

/// A recorded call and its notes.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Call {
    pub id: String,
    pub title: String,
    /// Set once you rename the call: the summary then keeps your title.
    pub title_edited: bool,
    /// Milliseconds since 1970.
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub status: CallStatus,
    /// The computer's sound was recorded too (the other people).
    pub system_audio: bool,
    pub speakers: Vec<Speaker>,
    /// While recording: the live transcript ("me" / "others"). Then the final one.
    pub lines: Vec<Line>,
    pub summary: Option<String>,
    pub key_points: Vec<String>,
    pub todos: Vec<Todo>,
    /// Why the last summary could not be written.
    pub summary_error: Option<String>,
    /// Why the transcript could not be written.
    pub error: Option<String>,
}

/// A call in the list (without its transcript).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CallListItem {
    pub id: String,
    pub title: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub status: CallStatus,
    pub has_summary: bool,
    pub open_todos: u32,
}

pub struct CallStore {
    conn: Mutex<Connection>,
}

fn json<T: Serialize>(v: &T) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "[]".into())
}

fn from_json<T: for<'de> Deserialize<'de> + Default>(s: String) -> T {
    serde_json::from_str(&s).unwrap_or_default()
}

fn call_from_row(row: &Row) -> rusqlite::Result<Call> {
    Ok(Call {
        id: row.get("id")?,
        title: row.get("title")?,
        title_edited: row.get::<_, i64>("title_edited")? != 0,
        started_at: row.get("started_at")?,
        ended_at: row.get("ended_at")?,
        status: CallStatus::parse(&row.get::<_, String>("status")?),
        system_audio: row.get::<_, i64>("system_audio")? != 0,
        speakers: from_json(row.get("speakers")?),
        lines: from_json(row.get("lines")?),
        summary: row.get("summary")?,
        key_points: from_json(row.get("key_points")?),
        todos: from_json(row.get("todos")?),
        summary_error: row.get("summary_error")?,
        error: row.get("error")?,
    })
}

impl CallStore {
    pub fn open(path: &Path) -> Result<CallStore> {
        let mut conn = Connection::open(path)?;
        let migrations = Migrations::new(MIGRATIONS.to_vec());
        #[cfg(debug_assertions)]
        migrations.validate()?;
        migrations.to_latest(&mut conn)?;
        Ok(CallStore {
            conn: Mutex::new(conn),
        })
    }

    #[cfg(test)]
    pub fn in_memory() -> CallStore {
        let mut conn = Connection::open_in_memory().unwrap();
        Migrations::new(MIGRATIONS.to_vec())
            .to_latest(&mut conn)
            .unwrap();
        CallStore {
            conn: Mutex::new(conn),
        }
    }

    fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Writes the whole call (inserted or replaced).
    pub fn save(&self, call: &Call) -> Result<()> {
        self.conn().execute(
            "INSERT OR REPLACE INTO calls (id, title, title_edited, started_at, ended_at, status,
                system_audio, speakers, lines, summary, key_points, todos, summary_error, error)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                call.id,
                call.title,
                call.title_edited as i64,
                call.started_at,
                call.ended_at,
                call.status.as_str(),
                call.system_audio as i64,
                json(&call.speakers),
                json(&call.lines),
                call.summary,
                json(&call.key_points),
                json(&call.todos),
                call.summary_error,
                call.error,
            ],
        )?;
        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<Option<Call>> {
        Ok(self
            .conn()
            .query_row(
                "SELECT * FROM calls WHERE id = ?1",
                params![id],
                call_from_row,
            )
            .optional()?)
    }

    pub fn list(&self) -> Result<Vec<CallListItem>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, title, started_at, ended_at, status, summary, key_points, todos
             FROM calls ORDER BY started_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let summary: Option<String> = row.get(5)?;
            let key_points: Vec<String> = from_json(row.get(6)?);
            let todos: Vec<Todo> = from_json(row.get(7)?);
            Ok(CallListItem {
                id: row.get(0)?,
                title: row.get(1)?,
                started_at: row.get(2)?,
                ended_at: row.get(3)?,
                status: CallStatus::parse(&row.get::<_, String>(4)?),
                has_summary: summary.is_some_and(|s| !s.is_empty()) || !key_points.is_empty(),
                open_todos: todos.iter().filter(|t| !t.done).count() as u32,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// Calls left recording or half-written by the last run.
    pub fn unfinished(&self) -> Result<Vec<Call>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM calls WHERE status IN ('recording', 'processing') ORDER BY started_at",
        )?;
        let rows = stmt.query_map([], call_from_row)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        self.conn()
            .execute("DELETE FROM calls WHERE id = ?1", params![id])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn call(id: &str, started_at: i64) -> Call {
        Call {
            id: id.into(),
            title: format!("Appel {id}"),
            title_edited: false,
            started_at,
            ended_at: None,
            status: CallStatus::Recording,
            system_audio: true,
            speakers: Vec::new(),
            lines: Vec::new(),
            summary: None,
            key_points: Vec::new(),
            todos: Vec::new(),
            summary_error: None,
            error: None,
        }
    }

    #[test]
    fn calls_round_trip_and_list_newest_first() {
        let store = CallStore::in_memory();
        store.save(&call("a", 1)).unwrap();
        let mut b = call("b", 2);
        b.status = CallStatus::Ready;
        b.summary = Some("On lance.".into());
        b.todos = vec![Todo {
            id: "t".into(),
            text: "Publier".into(),
            owner: Some("Théo".into()),
            due: None,
            done: false,
        }];
        store.save(&b).unwrap();
        let list = store.list().unwrap();
        assert_eq!(
            list.iter().map(|c| c.id.as_str()).collect::<Vec<_>>(),
            ["b", "a"]
        );
        assert!(list[0].has_summary);
        assert_eq!(list[0].open_todos, 1);
        let back = store.get("b").unwrap().unwrap();
        assert_eq!(back.todos[0].owner.as_deref(), Some("Théo"));
        assert_eq!(back.status, CallStatus::Ready);
        assert_eq!(
            store
                .unfinished()
                .unwrap()
                .iter()
                .map(|c| c.id.clone())
                .collect::<Vec<_>>(),
            ["a"]
        );
        store.delete("a").unwrap();
        assert!(store.get("a").unwrap().is_none());
    }
}
