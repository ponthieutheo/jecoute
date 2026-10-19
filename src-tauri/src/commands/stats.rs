use crate::managers::stats::{DictationStats, StatsManager};
use std::sync::Arc;
use tauri::State;

/// Les chiffres de la page Statistiques (calculés ici, jamais envoyés).
#[tauri::command]
#[specta::specta]
pub fn get_dictation_stats(
    stats_manager: State<'_, Arc<StatsManager>>,
) -> Result<DictationStats, String> {
    stats_manager.summary().map_err(|e| e.to_string())
}

/// Remet les statistiques à zéro ; l'historique n'est pas touché.
#[tauri::command]
#[specta::specta]
pub fn reset_dictation_stats(stats_manager: State<'_, Arc<StatsManager>>) -> Result<(), String> {
    stats_manager.reset().map_err(|e| e.to_string())
}
