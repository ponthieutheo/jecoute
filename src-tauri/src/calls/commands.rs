//! What the page can ask of the call recorder.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use tauri::{AppHandle, Manager};

use super::store::Call;
use super::{
    diarize, recorder, valid_id, writeup, CallOption, CallRecorder, CallsState, Download, ERR_BUSY,
};
use crate::settings::{get_settings, write_settings};

fn the_recorder(app: &AppHandle) -> Result<Arc<CallRecorder>, String> {
    recorder(app).ok_or_else(|| "the call recorder is not ready".to_string())
}

/// Every id sent by the page is checked before anything uses it (it may end
/// up in a path).
fn check_id(id: &str) -> Result<(), String> {
    if valid_id(id) {
        Ok(())
    } else {
        Err("invalid call id".into())
    }
}

#[tauri::command]
#[specta::specta]
pub fn calls_state(app: AppHandle) -> Result<CallsState, String> {
    Ok(the_recorder(&app)?.state())
}

#[tauri::command]
#[specta::specta]
pub fn call_get(app: AppHandle, id: String) -> Result<Option<Call>, String> {
    check_id(&id)?;
    the_recorder(&app)?
        .store
        .get(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn call_start(app: AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || super::start(&app))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
#[specta::specta]
pub async fn call_stop(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || super::stop(&app))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn call_rename(app: AppHandle, id: String, title: String) -> Result<(), String> {
    check_id(&id)?;
    let title = title.trim();
    if !title.is_empty() {
        the_recorder(&app)?.update(&id, |call| {
            call.title = title.to_string();
            call.title_edited = true;
        });
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn call_rename_speaker(
    app: AppHandle,
    id: String,
    speaker: String,
    name: String,
) -> Result<(), String> {
    check_id(&id)?;
    let name = name.trim();
    if !name.is_empty() {
        the_recorder(&app)?.update(&id, |call| {
            for s in call.speakers.iter_mut().filter(|s| s.id == speaker) {
                s.name = name.to_string();
            }
        });
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn call_toggle_todo(app: AppHandle, id: String, todo: String) -> Result<(), String> {
    check_id(&id)?;
    the_recorder(&app)?.update(&id, |call| {
        for t in call.todos.iter_mut().filter(|t| t.id == todo) {
            t.done = !t.done;
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn call_delete(app: AppHandle, id: String) -> Result<(), String> {
    check_id(&id)?;
    let rec = the_recorder(&app)?;
    // Only a call that exists has a folder that may be deleted.
    if rec.store.get(&id).map_err(|e| e.to_string())?.is_none() {
        return Err("this call no longer exists".into());
    }
    let recording = rec
        .ongoing
        .lock()
        .unwrap()
        .as_ref()
        .is_some_and(|o| o.id == id);
    if recording || rec.busy_with(&id) {
        return Err(ERR_BUSY.into());
    }
    rec.store.delete(&id).map_err(|e| e.to_string())?;
    if let Some(folder) = rec.folder(&id) {
        let _ = std::fs::remove_dir_all(folder);
    }
    rec.notify(Some(&id));
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn call_summarize(app: AppHandle, id: String) -> Result<(), String> {
    check_id(&id)?;
    std::thread::spawn(move || writeup::write_notes(&app, &id));
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn call_retry(app: AppHandle, id: String) -> Result<(), String> {
    check_id(&id)?;
    std::thread::spawn(move || writeup::write_call(&app, &id));
    Ok(())
}

/// A file name Windows accepts, from the call's title.
fn file_stem(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            c if c.is_control() => ' ',
            c => c,
        })
        .take(80)
        .collect();
    let cleaned = cleaned.trim().trim_end_matches('.').trim();
    if cleaned.is_empty() {
        "Appel".to_string()
    } else {
        cleaned.to_string()
    }
}

/// `dir/stem.md`, or `dir/stem 2.md`, `stem 3.md`… when taken.
fn free_path(dir: &Path, stem: &str) -> PathBuf {
    (1..)
        .map(|n| {
            let name = if n == 1 {
                format!("{stem}.md")
            } else {
                format!("{stem} {n}.md")
            };
            dir.join(name)
        })
        .find(|p| !p.exists())
        .expect("an unused name exists")
}

/// Saves the call as a Markdown file (written by the page, in its language)
/// in Documents, and shows it in the file explorer.
#[tauri::command]
#[specta::specta]
pub fn call_export(app: AppHandle, id: String, markdown: String) -> Result<String, String> {
    check_id(&id)?;
    let call = the_recorder(&app)?
        .store
        .get(&id)
        .map_err(|e| e.to_string())?
        .ok_or("this call no longer exists")?;
    let documents = app.path().document_dir().ok().filter(|d| d.is_dir());
    let dir = documents
        .or_else(|| app.path().home_dir().ok())
        .ok_or("no folder to save in")?;
    let path = free_path(&dir, &file_stem(&call.title));
    std::fs::write(&path, markdown).map_err(|e| e.to_string())?;
    let _ = tauri_plugin_opener::reveal_item_in_dir(&path);
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
#[specta::specta]
pub fn calls_download_voice_separation(app: AppHandle) -> Result<(), String> {
    let rec = the_recorder(&app)?;
    {
        let mut d = rec.download.lock().unwrap();
        if d.running {
            return Ok(());
        }
        *d = Download {
            running: true,
            ..Download::default()
        };
    }
    rec.notify(None);
    tauri::async_runtime::spawn(async move {
        let progress = rec.clone();
        let outcome = diarize::download(&rec.voices_dir, move |fraction| {
            progress.download.lock().unwrap().fraction = fraction;
            progress.notify(None);
        })
        .await;
        match &outcome {
            Ok(()) => log::info!("calls: the voice separator is downloaded"),
            Err(err) => log::warn!("calls: the voice separator could not be downloaded: {err}"),
        }
        {
            let mut d = rec.download.lock().unwrap();
            d.running = false;
            d.error = outcome.err();
        }
        rec.notify(None);
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn calls_remove_voice_separation(app: AppHandle) -> Result<(), String> {
    let rec = the_recorder(&app)?;
    let mut d = rec.download.lock().unwrap();
    if d.running {
        return Err(ERR_BUSY.into());
    }
    let _ = std::fs::remove_dir_all(&rec.voices_dir);
    d.error = None;
    drop(d);
    rec.notify(None);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn calls_set_option(app: AppHandle, option: CallOption, enabled: bool) -> Result<(), String> {
    let mut settings = get_settings(&app);
    let field = match option {
        CallOption::SystemAudio => &mut settings.call_system_audio,
        CallOption::VoiceSeparation => &mut settings.call_diarization,
        CallOption::Summary => &mut settings.call_summary,
    };
    *field = enabled;
    write_settings(&app, settings);
    if let Some(rec) = recorder(&app) {
        rec.notify(None);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_that_could_leave_the_calls_folder_are_refused() {
        let bad = [
            "..",
            "..\\..",
            "../../Windows",
            "1a2b3c4d/..",
            "1a2b3c4d\\..\\..",
            "C:\\Users",
            "\\\\server\\share",
            "/etc",
            "1A2B3C4D",
            "1a2b3c4d ",
            "",
            "abc",
            "0123456789abcdef0123456789abcdef0",
        ];
        for id in bad {
            assert!(check_id(id).is_err(), "{id:?} accepted");
        }
        assert!(check_id(&crate::calls::transcript::unique_id()).is_ok());
        assert!(check_id("1a1535974c10015").is_ok());
    }

    #[test]
    fn export_names_are_safe_and_free() {
        assert_eq!(file_stem("Point: v2 / sortie?"), "Point- v2 - sortie-");
        assert_eq!(file_stem("  ...  "), "Appel");
        let dir = tempfile::tempdir().unwrap();
        let first = free_path(dir.path(), "Appel");
        assert!(first.ends_with("Appel.md"));
        std::fs::write(&first, "x").unwrap();
        assert!(free_path(dir.path(), "Appel").ends_with("Appel 2.md"));
    }
}
