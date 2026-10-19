//! L'appli au premier plan au moment du collage, pour « Où tu dictes » dans
//! les statistiques. Seulement le nom du programme : jamais le titre de la
//! fenêtre ni son contenu.

use std::path::Path;

/// Un programme : `id` est le nom du .exe en minuscules (« windowsterminal »),
/// `name` ce qu'on montre (« Windows Terminal »).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ForegroundApp {
    pub id: String,
    pub name: String,
}

/// Ce qui n'est pas un endroit où l'on dicte : J’écoute elle-même, et les
/// morceaux de Windows (barre des tâches, menu Démarrer, recherche, écran de
/// verrouillage, clavier tactile, hôte des applis du Store).
fn is_shell(id: &str) -> bool {
    const IGNORED: [&str; 10] = [
        "jecoute",
        "handy",
        "explorer",
        "startmenuexperiencehost",
        "shellexperiencehost",
        "searchhost",
        "searchapp",
        "lockapp",
        "textinputhost",
        "applicationframehost",
    ];
    IGNORED.contains(&id)
}

/// Les noms courts des applis courantes (la description du .exe est parfois
/// longue ou vide).
fn known_name(id: &str) -> Option<&'static str> {
    Some(match id {
        "windowsterminal" => "Windows Terminal",
        "chrome" => "Chrome",
        "msedge" => "Edge",
        "firefox" => "Firefox",
        "brave" => "Brave",
        "opera" => "Opera",
        "vivaldi" => "Vivaldi",
        "code" => "VS Code",
        "cursor" => "Cursor",
        "windsurf" => "Windsurf",
        "discord" => "Discord",
        "slack" => "Slack",
        "ms-teams" | "teams" => "Teams",
        "outlook" | "olk" => "Outlook",
        "thunderbird" => "Thunderbird",
        "winword" => "Word",
        "excel" => "Excel",
        "powerpnt" => "PowerPoint",
        "onenote" => "OneNote",
        "whatsapp" | "whatsapp.root" => "WhatsApp",
        "telegram" => "Telegram",
        "signal" => "Signal",
        "claude" => "Claude",
        "chatgpt" => "ChatGPT",
        "obsidian" => "Obsidian",
        "notion" => "Notion",
        "powershell" | "pwsh" => "PowerShell",
        "wezterm-gui" => "WezTerm",
        "alacritty" => "Alacritty",
        _ => return None,
    })
}

/// « obsidian » → « Obsidian ».
fn capitalized(stem: &str) -> String {
    let mut chars = stem.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

/// Le nom lisible d'un programme : la table ci-dessus, sinon la description du
/// fichier (« Bloc-notes »), sinon le nom du .exe avec une majuscule.
pub fn describe(path: &Path) -> Option<ForegroundApp> {
    let stem = path.file_stem()?.to_string_lossy().to_string();
    let id = stem.to_lowercase();
    if id.is_empty() || is_shell(&id) {
        return None;
    }
    let name = known_name(&id)
        .map(str::to_string)
        .or_else(|| file_description(path))
        .unwrap_or_else(|| capitalized(&stem));
    Some(ForegroundApp { id, name })
}

/// Le .exe de la fenêtre au premier plan, sauf J’écoute elle-même.
#[cfg(windows)]
pub fn foreground_exe() -> Option<std::path::PathBuf> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
        if pid == 0 || pid == std::process::id() {
            return None;
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        )
        .is_ok();
        let _ = CloseHandle(process);
        if !ok {
            return None;
        }
        Some(std::path::PathBuf::from(String::from_utf16_lossy(
            &buf[..len as usize],
        )))
    }
}

#[cfg(not(windows))]
pub fn foreground_exe() -> Option<std::path::PathBuf> {
    None
}

/// La « Description du fichier » d'un .exe, dans sa première langue.
#[cfg(windows)]
fn file_description(path: &Path) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
    };

    let wide = |s: &std::ffi::OsStr| -> Vec<u16> { s.encode_wide().chain(Some(0)).collect() };
    let file = wide(path.as_os_str());
    unsafe {
        let size = GetFileVersionInfoSizeW(PCWSTR(file.as_ptr()), None);
        if size == 0 {
            return None;
        }
        let mut data = vec![0u8; size as usize];
        GetFileVersionInfoW(PCWSTR(file.as_ptr()), None, size, data.as_mut_ptr().cast()).ok()?;

        let mut ptr: *mut core::ffi::c_void = std::ptr::null_mut();
        let mut len = 0u32;
        let key = wide(std::ffi::OsStr::new("\\VarFileInfo\\Translation"));
        if !VerQueryValueW(
            data.as_ptr().cast(),
            PCWSTR(key.as_ptr()),
            &mut ptr,
            &mut len,
        )
        .as_bool()
            || len < 4
            || ptr.is_null()
        {
            return None;
        }
        let pair = std::slice::from_raw_parts(ptr as *const u16, 2);
        let sub = format!(
            "\\StringFileInfo\\{:04x}{:04x}\\FileDescription",
            pair[0], pair[1]
        );
        let key = wide(std::ffi::OsStr::new(&sub));
        let mut ptr: *mut core::ffi::c_void = std::ptr::null_mut();
        let mut len = 0u32;
        if !VerQueryValueW(
            data.as_ptr().cast(),
            PCWSTR(key.as_ptr()),
            &mut ptr,
            &mut len,
        )
        .as_bool()
            || len == 0
            || ptr.is_null()
        {
            return None;
        }
        let chars = std::slice::from_raw_parts(ptr as *const u16, len as usize);
        let text = String::from_utf16_lossy(chars);
        clean_description(&text)
    }
}

#[cfg(not(windows))]
fn file_description(_path: &Path) -> Option<String> {
    None
}

/// Une description utilisable comme nom : sans le zéro final ni « .exe », pas
/// trop longue.
#[cfg_attr(not(windows), allow(dead_code))]
fn clean_description(raw: &str) -> Option<String> {
    let text = raw.trim_end_matches('\0').trim();
    let text = text
        .strip_suffix(".exe")
        .or_else(|| text.strip_suffix(".EXE"))
        .unwrap_or(text)
        .trim();
    if text.is_empty() || text.chars().count() > 40 {
        return None;
    }
    Some(text.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn known_apps_get_their_short_name() {
        let app = describe(&PathBuf::from(
            r"C:\Program Files\WindowsApps\Microsoft.WindowsTerminal\WindowsTerminal.exe",
        ))
        .unwrap();
        assert_eq!(app.id, "windowsterminal");
        assert_eq!(app.name, "Windows Terminal");
        let chrome = describe(&PathBuf::from(r"C:\x\chrome.exe")).unwrap();
        assert_eq!(chrome.name, "Chrome");
    }

    #[test]
    fn the_desktop_itself_is_never_an_app() {
        assert!(describe(&PathBuf::from(r"C:\Windows\explorer.exe")).is_none());
        assert!(describe(&PathBuf::from(r"C:\x\SearchHost.exe")).is_none());
        assert!(describe(&PathBuf::from(r"C:\x\jecoute.exe")).is_none());
    }

    #[test]
    fn descriptions_are_cleaned() {
        assert_eq!(
            clean_description("Notepad.exe\0").as_deref(),
            Some("Notepad")
        );
        assert_eq!(
            clean_description("  Bloc-notes "),
            Some("Bloc-notes".into())
        );
        assert_eq!(clean_description("\0"), None);
        assert_eq!(capitalized("obsidian"), "Obsidian");
    }
}
