use crate::managers::stats::{DictationStats, StatsManager};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

/// Les statistiques, absentes si `stats.db` n'a pas pu être ouverte au lancement.
fn stats(app: &AppHandle) -> Result<Arc<StatsManager>, String> {
    app.try_state::<Arc<StatsManager>>()
        .map(|s| s.inner().clone())
        .ok_or_else(|| "stats unavailable: stats.db could not be opened".to_string())
}

/// Les chiffres de la page Statistiques (calculés ici, jamais envoyés).
#[tauri::command]
#[specta::specta]
pub fn get_dictation_stats(app: AppHandle) -> Result<DictationStats, String> {
    stats(&app)?.summary().map_err(|e| e.to_string())
}

/// Remet les statistiques à zéro ; l'historique n'est pas touché.
#[tauri::command]
#[specta::specta]
pub fn reset_dictation_stats(app: AppHandle) -> Result<(), String> {
    stats(&app)?.reset().map_err(|e| e.to_string())
}
