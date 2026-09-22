use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
#[cfg(windows)]
use windows_sys::Win32::Foundation::{HWND, LPARAM, RECT, TRUE};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowRect, IsIconic, IsWindowVisible,
};

// Rects (logical px, relative to our window) that should capture the mouse.
static CLICKABLE: Mutex<Vec<[f64; 4]>> = Mutex::new(Vec::new());
static DRAGGING: AtomicBool = AtomicBool::new(false);
// global mouse-button state via the rdev listener — cross-platform
// replacement for GetAsyncKeyState; a missed release only delays a
// click-through toggle until the next press cycle, never wedges it
static MOUSE_HELD: AtomicI32 = AtomicI32::new(0);
// per-monitor rects in window-logical px [x, y, w, h] — filled at setup
// when the overlay spans more than one display
static MON_LIST: Mutex<Vec<[f64; 4]>> = Mutex::new(Vec::new());

#[tauri::command]
fn get_monitors() -> Vec<[f64; 4]> {
    MON_LIST.lock().unwrap().clone()
}

#[tauri::command]
fn set_clickable(rects: Vec<[f64; 4]>) {
    *CLICKABLE.lock().unwrap() = rects;
}

#[tauri::command]
fn set_dragging(on: bool) {
    DRAGGING.store(on, Ordering::Relaxed);
}

#[tauri::command]
fn save_state(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let state = dir.join("state.json");
    let tmp = dir.join("state.json.tmp");
    // write to a temp file first so a crash mid-write can't corrupt the save;
    // keep the previous good state as .bak for load_state to fall back on
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    if state.exists() {
        let _ = std::fs::copy(&state, dir.join("state.json.bak"));
    }
    std::fs::rename(&tmp, &state).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_state(app: tauri::AppHandle) -> String {
    let Ok(dir) = app.path().app_data_dir() else {
        return "{}".into();
    };
    // fall back to the last-good backup if the main save won't parse
    for name in ["state.json", "state.json.bak"] {
        if let Ok(txt) = std::fs::read_to_string(dir.join(name)) {
            if serde_json::from_str::<serde_json::Value>(&txt).is_ok() {
                return txt;
            }
        }
    }
    "{}".into()
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// forensic log: frontend frame errors + a heartbeat so a frozen app can
// tell us afterwards whether JS was still alive and what threw
#[tauri::command]
fn log_crash(app: tauri::AppHandle, msg: String) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let _ = std::fs::create_dir_all(&dir);
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let line = format!("[{ms}] {}\n", msg.replace('\n', " | "));
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("crash.log"))
    {
        use std::io::Write;
        let _ = f.write_all(line.as_bytes());
        // cap the file at ~256KB: when it grows past, truncate to the tail
        if let Ok(meta) = f.metadata() {
            if meta.len() > 256 * 1024 {
                let _ = f.set_len(0);
                let _ = f.write_all(b"[log truncated]\n");
            }
        }
    }
}

// minimal base64 decoder for PNG data URLs (avoids a crate dependency)
fn b64decode(s: &str) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let mut buf = 0u32;
    let mut n = 0u32;
    for &b in s.as_bytes() {
        let v = match b {
            b'A'..=b'Z' => b - b'A',
            b'a'..=b'z' => b - b'a' + 26,
            b'0'..=b'9' => b - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' => break,
            _ => continue,
        } as u32;
        buf = (buf << 6) | v;
        n += 1;
        if n == 4 {
            out.extend_from_slice(&buf.to_be_bytes()[1..]);
            buf = 0;
            n = 0;
        }
    }
    match n {
        3 => {
            out.push((buf >> 10) as u8);
            out.push((buf >> 2) as u8);
        }
        2 => out.push((buf >> 4) as u8),
        _ => {}
    }
    Ok(out)
}

// demo builds ship the same exe + an empty demo.flag next to it
#[tauri::command]
fn is_demo() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("demo.flag").exists()))
        .unwrap_or(false)
}

fn photos_dir(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("photos"))
}

// tiny recursive copy for the identifier-migration (photos/ dir)
fn copy_dir(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for e in std::fs::read_dir(src)?.flatten() {
        let dest = dst.join(e.file_name());
        if e.path().is_dir() {
            copy_dir(&e.path(), &dest)?;
        } else {
            std::fs::copy(e.path(), dest)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn list_photos(app: tauri::AppHandle) -> Vec<String> {
    let Some(dir) = photos_dir(&app) else { return vec![] };
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| {
                    let n = e.file_name().to_string_lossy().into_owned();
                    if n.ends_with(".png") { Some(n) } else { None }
                })
                .collect()
        })
        .unwrap_or_default();
    names.sort();
    names
}

// minimal base64 encoder for returning photo bytes to the frontend
fn b64encode(data: &[u8]) -> String {
    const TBL: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len() * 4 / 3 + 4);
    for c in data.chunks(3) {
        let n = ((c[0] as u32) << 16) | ((*c.get(1).unwrap_or(&0) as u32) << 8) | (*c.get(2).unwrap_or(&0) as u32);
        out.push(TBL[(n >> 18) as usize & 63] as char);
        out.push(TBL[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 { TBL[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if c.len() > 2 { TBL[n as usize & 63] as char } else { '=' });
    }
    out
}

#[tauri::command]
fn load_photo(app: tauri::AppHandle, name: String) -> Result<String, String> {
    let Some(dir) = photos_dir(&app) else { return Err("no photos dir".into()) };
    let safe: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '_' })
        .collect();
    let data = std::fs::read(dir.join(safe)).map_err(|e| e.to_string())?;
    Ok(b64encode(&data))
}

#[tauri::command]
fn delete_photo(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let Some(dir) = photos_dir(&app) else { return Err("no photos dir".into()) };
    let safe: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '_' })
        .collect();
    std::fs::remove_file(dir.join(safe)).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_photos(app: tauri::AppHandle) -> Result<(), String> {
    let Some(dir) = photos_dir(&app) else { return Err("no photos dir".into()) };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    open_with_shell(&dir.to_string_lossy())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    // gem-shop store link — only ever https, opened in the default browser
    if !url.starts_with("https://") {
        return Err("refusing non-https url".into());
    }
    open_with_shell(&url)
}

// gem-code verification: codes are Ed25519 signatures minted offline by
// codes.cjs. only the PUBLIC key ships inside the binary — unpacking the
// exe can reveal it but can never sign a new code, so forged gems are
// impossible without stealing seller_ed25519.key from the seller's disk.
const GEM_PUBKEY: [u8; 32] = [
    0x09, 0x6F, 0xFD, 0x17, 0xAF, 0x68, 0x85, 0x4C, 0x92, 0x9C, 0xB7, 0xFE, 0xFF, 0x81, 0x4A, 0x6A,
    0x40, 0xCC, 0xD5, 0x00, 0xC7, 0x49, 0xC5, 0x05, 0xF3, 0x5D, 0x55, 0xB2, 0x81, 0x35, 0x42, 0xAC,
];
const GEM_AMOUNTS: [(&str, u64); 4] = [("A", 250), ("B", 500), ("C", 1000), ("D", 2500)];

fn b32dec(s: &str) -> Option<Vec<u8>> {
    // RFC4648 base32, no padding — decode exactly the bits present
    let mut out = Vec::with_capacity(s.len() * 5 / 8);
    let (mut acc, mut bits) = (0u64, 0u32);
    for c in s.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'2'..=b'7' => c - b'2' + 26,
            _ => return None,
        } as u64;
        acc = (acc << 5) | v;
        bits += 5;
        if bits >= 8 {
            out.push((acc >> (bits - 8)) as u8);
            bits -= 8;
        }
    }
    Some(out)
}

fn verify_code_with(pubkey: &[u8; 32], code: &str) -> Result<u64, String> {
    use ed25519_dalek::Verifier as _;
    let up = code.trim().to_uppercase();
    let body = up.strip_prefix("JELLYPAL-").unwrap_or(up.as_str());
    let mut it = body.split('-');
    let pack = it.next().ok_or("bad code")?;
    let nonce = it.next().ok_or("bad code")?;
    let sigs = it.next().ok_or("bad code")?;
    if it.next().is_some() || nonce.len() != 8 {
        return Err("bad code".into());
    }
    let gems = GEM_AMOUNTS
        .iter()
        .find(|(p, _)| *p == pack)
        .ok_or("bad code")?
        .1;
    let sig_bytes = b32dec(sigs).ok_or("bad code")?;
    if sig_bytes.len() != 64 {
        return Err("bad code".into());
    }
    let sig = ed25519_dalek::Signature::from_slice(&sig_bytes).map_err(|e| e.to_string())?;
    let vk = ed25519_dalek::VerifyingKey::from_bytes(pubkey).map_err(|e| e.to_string())?;
    let msg = format!("JP2:{pack}:{nonce}");
    vk.verify(msg.as_bytes(), &sig).map_err(|_| "bad code".to_string())?;
    Ok(gems)
}

#[tauri::command]
fn verify_gem_code(code: String) -> Result<u64, String> {
    verify_code_with(&GEM_PUBKEY, &code)
}

#[tauri::command]
fn check_update(url: String) -> Result<String, String> {
    // version probe — fetches a tiny text file (e.g. "0.2.1") hosted next to
    // the itch page. curl.exe ships with Windows 10+, so no http crate needed
    if !url.starts_with("https://") {
        return Err("refusing non-https url".into());
    }
    let out = std::process::Command::new("curl")
        .args(["-s", "--max-time", "6", &url])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err("curl failed".into());
    }
    let body = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if body.is_empty() || body.len() > 32 {
        return Err("bad version payload".into());
    }
    Ok(body)
}

fn curl_get(url: &str, max_secs: &str) -> Option<String> {
    let out = std::process::Command::new("curl")
        .args(["-s", "--max-time", max_secs, url])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).to_string())
}

#[tauri::command]
fn get_weather() -> Option<i64> {
    // local weather for cosmetic reactions (umbrella, snowflakes).
    // ipapi.co gives coarse lat/lon over https; open-meteo needs no key.
    let geo = curl_get("https://ipapi.co/json/", "5")?;
    let g: serde_json::Value = serde_json::from_str(&geo).ok()?;
    let lat = g.get("latitude")?.as_f64()?;
    let lon = g.get("longitude")?.as_f64()?;
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current_weather=true",
        lat, lon
    );
    let met = curl_get(&url, "5")?;
    let m: serde_json::Value = serde_json::from_str(&met).ok()?;
    m.pointer("/current_weather/weathercode")?.as_i64()
}

#[tauri::command]
fn set_autostart(enable: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        // HKCU Run key — the slime is meant to live on the desktop, so it
        // belongs in startup when the user asks for it
        let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
        if enable {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let path = format!("\"{}\"", exe.display());
            std::process::Command::new("reg")
                .args(["add", key, "/v", "Jellypal", "/t", "REG_SZ", "/d", &path, "/f"])
                .output()
                .map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new("reg")
                .args(["delete", key, "/v", "Jellypal", "/f"])
                .output()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        // per-user LaunchAgent — the macOS equivalent of the Run key
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        let dir = std::path::PathBuf::from(home).join("Library/LaunchAgents");
        let plist = dir.join("com.jellypal.desktop.plist");
        if enable {
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let body = format!(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
                 <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
                 <plist version=\"1.0\"><dict>\n\
                 <key>Label</key><string>com.jellypal.desktop</string>\n\
                 <key>ProgramArguments</key><array><string>{}</string></array>\n\
                 <key>RunAtLoad</key><true/>\n\
                 </dict></plist>\n",
                exe.display()
            );
            std::fs::write(&plist, body).map_err(|e| e.to_string())?;
        } else if plist.exists() {
            std::fs::remove_file(&plist).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = enable;
        return Err("autostart not supported on this platform".into());
    }
}

#[tauri::command]
fn save_png(app: tauri::AppHandle, data: String, name: String) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("photos");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let path = dir.join(format!("{safe}.png"));
    std::fs::write(&path, b64decode(&data)?).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(windows)]
unsafe extern "system" fn enum_windows_cb(hwnd: HWND, lparam: LPARAM) -> i32 {
    let rects = &mut *(lparam as *mut Vec<[i32; 4]>);
    if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
        return TRUE;
    }
    let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
    if GetWindowRect(hwnd, &mut r) != 0 {
        let w = r.right - r.left;
        let h = r.bottom - r.top;
        if w > 80 && h > 30 {
            rects.push([r.left, r.top, r.right, r.bottom]);
        }
    }
    TRUE
}

// every visible top-level window's screen rect in PHYSICAL px — feeds the
// slime's "sit on window tops" platform scan. `scale` converts macOS point
// coordinates (CGWindowList reports points, not pixels) to physical px;
// Windows rects are already physical.
#[cfg(windows)]
fn collect_window_rects(_scale: f64) -> Vec<[i32; 4]> {
    let mut rects: Vec<[i32; 4]> = Vec::new();
    unsafe {
        EnumWindows(
            Some(enum_windows_cb),
            &mut rects as *mut Vec<[i32; 4]> as LPARAM,
        );
    }
    rects
}

#[cfg(target_os = "macos")]
fn collect_window_rects(scale: f64) -> Vec<[i32; 4]> {
    // CGWindowListCopyWindowInfo exposes bounds + owner pid for every
    // on-screen window without needing screen-recording permission.
    // Bounds come back in POINTS — multiplied by `scale` so the return
    // value is physical px on every platform (the caller's math assumes
    // the same space as cursor_position()/monitor position).
    use core_foundation::array::{CFArrayGetCount, CFArrayGetValueAtIndex};
    use core_foundation::base::{CFType, TCFType};
    use core_foundation::dictionary::{CFDictionaryGetValue, CFDictionaryRef};
    use core_foundation::number::{kCFNumberFloat64Type, CFNumberGetValue, CFNumberRef};
    use core_foundation::string::CFString;
    use core_graphics::window::{
        kCGNullWindowID, kCGWindowListOptionOnScreenOnly, CGWindowListCopyWindowInfo,
    };
    use std::ffi::c_void;

    unsafe fn num(dict: CFDictionaryRef, key: &CFString) -> Option<f64> {
        let v = CFDictionaryGetValue(dict, key.as_concrete_TypeRef() as *const c_void);
        if v.is_null() {
            return None;
        }
        let mut out = 0f64;
        if !CFNumberGetValue(
            v as CFNumberRef,
            kCFNumberFloat64Type,
            &mut out as *mut _ as *mut c_void,
        ) {
            return None;
        }
        Some(out)
    }

    let mut out = Vec::new();
    let my_pid = std::process::id();
    unsafe {
        let list = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID);
        if list.is_null() {
            return out;
        }
        // RAII guard releases the CFArray on scope exit
        let _arr: core_foundation::array::CFArray<CFType> =
            core_foundation::array::CFArray::wrap_under_create_rule(list);
        let layer_key = CFString::new("kCGWindowLayer");
        let pid_key = CFString::new("kCGWindowOwnerPID");
        let bounds_key = CFString::new("kCGWindowBounds");
        let x_key = CFString::new("X");
        let y_key = CFString::new("Y");
        let w_key = CFString::new("Width");
        let h_key = CFString::new("Height");
        for i in 0..CFArrayGetCount(list) {
            let dict = CFArrayGetValueAtIndex(list, i) as CFDictionaryRef;
            if dict.is_null() {
                continue;
            }
            // layer 0 = regular app windows (skip menubar, dock, overlays)
            match num(dict, &layer_key) {
                Some(l) if l as i32 == 0 => {}
                _ => continue,
            }
            // never perch on our own overlay
            if let Some(pid) = num(dict, &pid_key) {
                if pid as u32 == my_pid {
                    continue;
                }
            }
            let bd = CFDictionaryGetValue(dict, bounds_key.as_concrete_TypeRef() as *const c_void)
                as CFDictionaryRef;
            if bd.is_null() {
                continue;
            }
            let (Some(x), Some(y), Some(w), Some(h)) = (
                num(bd, &x_key),
                num(bd, &y_key),
                num(bd, &w_key),
                num(bd, &h_key),
            ) else {
                continue;
            };
            if w > 80.0 && h > 30.0 {
                out.push([
                    (x * scale) as i32,
                    (y * scale) as i32,
                    ((x + w) * scale) as i32,
                    ((y + h) * scale) as i32,
                ]);
            }
        }
    }
    out
}

#[cfg(not(any(windows, target_os = "macos")))]
fn collect_window_rects(_scale: f64) -> Vec<[i32; 4]> {
    Vec::new()
}

// the copy/paste modifier differs per platform — Cmd on macOS, Ctrl
// elsewhere (on Windows the Meta key is the Win key, and Win+V opens
// clipboard history — it must not count as a paste)
#[cfg(target_os = "macos")]
fn is_combo_modifier(k: rdev::Key) -> bool {
    matches!(k, rdev::Key::MetaLeft | rdev::Key::MetaRight)
}
#[cfg(not(target_os = "macos"))]
fn is_combo_modifier(k: rdev::Key) -> bool {
    matches!(k, rdev::Key::ControlLeft | rdev::Key::ControlRight)
}

// open a folder or url with the OS default handler
fn open_with_shell(target: &str) -> Result<(), String> {
    #[cfg(windows)]
    let cmd = "explorer";
    #[cfg(target_os = "macos")]
    let cmd = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let cmd = "xdg-open";
    std::process::Command::new(cmd)
        .arg(target)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // seller diagnostic: `jellypal.exe --verify-code JELLYPAL-...` checks a
    // minted code against the embedded pubkey and exits — handy to confirm
    // a Stripe/Gumroad code really works before listing it
    let args: Vec<String> = std::env::args().collect();
    if let Some(pos) = args.iter().position(|a| a == "--verify-code") {
        // release builds are windows-subsystem — attach to the parent's
        // console or the answer never reaches the terminal
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
        let code = args.get(pos + 1).map(|s| s.as_str()).unwrap_or("");
        match verify_gem_code(code.to_string()) {
            Ok(gems) => {
                println!("VALID - {gems} gems");
                std::process::exit(0);
            }
            Err(e) => {
                println!("INVALID - {e}");
                std::process::exit(1);
            }
        }
    }

    std::panic::set_hook(Box::new(|info| {
        let p = std::env::temp_dir().join("jellypal-panic.log");
        let _ = std::fs::write(p, format!("{info}"));
    }));

    tauri::Builder::default()
        // single instance: a second launch exits instead of fighting the
        // first over the webview user-data dir — that contention froze the
        // newcomer into "not responding" on Windows. The callback fires in
        // the *running* instance, so a re-launch summons the pal instead of
        // doing nothing. (was a hand-rolled Win32 mutex; the plugin covers
        // macOS/Linux socket-based dedup too)
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            app.emit("summon", ()).ok();
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_state,
            load_state,
            set_clickable,
            set_dragging,
            quit_app,
            log_crash,
            save_png,
            is_demo,
            list_photos,
            load_photo,
            delete_photo,
            open_photos,
            open_url,
            verify_gem_code,
            check_update,
            get_monitors,
            get_weather,
            set_autostart
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // identifier migration: com.jellypal.app -> com.jellypal.desktop
            // (the .app suffix collides with macOS bundle semantics). If the
            // new data dir has no save but the old one does, copy everything
            // over so existing installs keep their slimes/photos/settings.
            if let Ok(new_dir) = app.path().app_data_dir() {
                if !new_dir.join("state.json").exists() {
                    let old_dir = app
                        .path()
                        .app_data_dir()
                        .ok()
                        .and_then(|d| d.parent().map(|p| p.join("com.jellypal.app")));
                    if let Some(old_dir) = old_dir {
                        if old_dir.join("state.json").exists() {
                            let _ = std::fs::create_dir_all(&new_dir);
                            if let Ok(rd) = std::fs::read_dir(&old_dir) {
                                for e in rd.flatten() {
                                    let dest = new_dir.join(e.file_name());
                                    if e.path().is_dir() {
                                        let _ = copy_dir(&e.path(), &dest);
                                    } else {
                                        let _ = std::fs::copy(e.path(), dest);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Cover the whole (primary) monitor.
            let mut mpos = tauri::PhysicalPosition::new(0, 0);
            let mut msize = tauri::PhysicalSize::new(1920, 1080);
            let mut scale = 1.0f64;
            if let Some(monitor) = window.current_monitor()? {
                scale = monitor.scale_factor();
                msize = *monitor.size();
                mpos = *monitor.position();
            }
            // multi-monitor: stretch the overlay across the whole virtual
            // screen so slimes can wander between displays. positions can
            // be negative (secondary left/up of primary) — every consumer
            // already converts via (point - mpos) / scale, so only the
            // origin and size change. per-monitor rects go to the frontend
            // so each display gets its own floor platform
            if let Ok(mons) = window.available_monitors() {
                if mons.len() > 1 {
                    let mut minx = i32::MAX;
                    let mut miny = i32::MAX;
                    let mut maxx = i32::MIN;
                    let mut maxy = i32::MIN;
                    let mut rects: Vec<[f64; 4]> = Vec::new();
                    for m in &mons {
                        let p = m.position();
                        let s = m.size();
                        minx = minx.min(p.x);
                        miny = miny.min(p.y);
                        maxx = maxx.max(p.x + s.width as i32);
                        maxy = maxy.max(p.y + s.height as i32);
                        rects.push([p.x as f64, p.y as f64, s.width as f64, s.height as f64]);
                    }
                    *MON_LIST.lock().unwrap() = rects
                        .iter()
                        .map(|r| {
                            [
                                (r[0] - minx as f64) / scale,
                                (r[1] - miny as f64) / scale,
                                r[2] / scale,
                                r[3] / scale,
                            ]
                        })
                        .collect();
                    mpos = tauri::PhysicalPosition::new(minx, miny);
                    msize = tauri::PhysicalSize::new((maxx - minx) as u32, (maxy - miny) as u32);
                }
            }
            window.set_size(tauri::Size::Physical(msize))?;
            window.set_position(tauri::Position::Physical(mpos))?;
            window.set_ignore_cursor_events(true)?;

            // desktop companion shouldn't take a Dock slot on macOS — the
            // menu-bar tray icon is the only persistent UI affordance
            #[cfg(target_os = "macos")]
            app.handle()
                .set_activation_policy(tauri::ActivationPolicy::Accessory);

            let summon = MenuItem::with_id(app, "summon", "Summon", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&summon, &quit])?;
            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Jellypal")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "summon" => {
                        app.emit("summon", ()).ok();
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Global keystroke counter; never inspect which key — except
            // the modifier so copy/paste/cut combos can be spotted
            // (combo detection only; typed content is never read).
            // ctrl on Windows/Linux, meta (Cmd) on macOS — see
            // is_combo_modifier for why they differ
            let handle = app.handle().clone();
            let log_dir = app.path().app_data_dir().ok();
            std::thread::spawn(move || {
                let mut modifier = false;
                if let Err(e) = rdev::listen(move |event| {
                    match event.event_type {
                        rdev::EventType::KeyPress(k) => {
                            let _ = handle.emit("keystroke", ());
                            if is_combo_modifier(k) {
                                modifier = true;
                            } else {
                                match k {
                                    rdev::Key::KeyC | rdev::Key::KeyX if modifier => {
                                        let _ = handle.emit("copy", ());
                                    }
                                    rdev::Key::KeyV if modifier => {
                                        let _ = handle.emit("paste", ());
                                    }
                                    _ => {}
                                }
                            }
                        }
                        rdev::EventType::KeyRelease(k) => {
                            if is_combo_modifier(k) {
                                modifier = false;
                            }
                        }
                        // tracked globally so the click-through toggle never
                        // flips mid-gesture (that swap is what wedged input)
                        rdev::EventType::ButtonPress(_) => {
                            MOUSE_HELD.fetch_add(1, Ordering::Relaxed);
                        }
                        rdev::EventType::ButtonRelease(_) => {
                            MOUSE_HELD
                                .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| {
                                    Some((v - 1).max(0))
                                })
                                .ok();
                        }
                        _ => {}
                    }
                }) {
                    if let Some(dir) = log_dir {
                        let _ = std::fs::create_dir_all(&dir);
                        let _ = std::fs::write(
                            dir.join("hook.log"),
                            format!("rdev listen failed: {e:?}"),
                        );
                    }
                }
            });

            // Click-through toggle: capture mouse only when it is over the pet
            // or an open UI panel. Everything else passes through.
            let win_poll = window.clone();
            std::thread::spawn(move || {
                let mut inside = false;
                let mut last_cur = (0.0f64, 0.0f64);
                let mut tick = 0u32;
                loop {
                    std::thread::sleep(Duration::from_millis(30));
                    tick += 1;
                    if tick % 66 == 1 {
                        // foreground app name + window title — cross-platform
                        // via active-win-pos-rs (title may be empty on macOS
                        // without screen-recording permission; the app name
                        // alone still classifies fine)
                        if let Ok(aw) = active_win_pos_rs::get_active_window() {
                            // emit both signals: process stem keeps parity
                            // with the old exe-name feed (msedge, chrome);
                            // app_name covers macOS bundle names ("Safari")
                            // and UWP/FileDescription oddballs
                            let stem = aw
                                .process_path
                                .file_stem()
                                .map(|s| s.to_string_lossy().into_owned())
                                .unwrap_or_default();
                            let _ = win_poll.emit(
                                "focus",
                                [aw.title, format!("{} {}", stem, aw.app_name).to_lowercase()],
                            );
                        }
                    }
                    // global cursor position in physical screen px
                    let (cx, cy) = win_poll
                        .cursor_position()
                        .map(|p| (p.x as i32, p.y as i32))
                        .unwrap_or_default();
                    let lx = (cx - mpos.x) as f64 / scale;
                    let ly = (cy - mpos.y) as f64 / scale;
                    if (lx - last_cur.0).abs() + (ly - last_cur.1).abs() > 3.0 {
                        last_cur = (lx, ly);
                        let _ = win_poll.emit("cursor", [lx, ly]);
                    }
                    let now_inside = DRAGGING.load(Ordering::Relaxed)
                        || CLICKABLE
                            .lock()
                            .unwrap()
                            .iter()
                            .any(|r| {
                                lx >= r[0] && lx <= r[0] + r[2] && ly >= r[1] && ly <= r[1] + r[3]
                            });
                    // never flip click-through while a mouse button is held —
                    // toggling mid-gesture can deadlock the webview's input
                    // pipeline and hang the window
                    let btn_held = MOUSE_HELD.load(Ordering::Relaxed) > 0;
                    if now_inside != inside && !btn_held {
                        inside = now_inside;
                        let _ = win_poll.set_ignore_cursor_events(!inside);
                    }
                    // live click-state snapshot every ~1s — proves whether the
                    // frontend's rects arrived and whether the poll loop is
                    // alive, without needing the app to be instrumented
                    if tick % 33 == 2 {
                        if let Ok(dir) = win_poll.app_handle().path().app_data_dir() {
                            let n = CLICKABLE.lock().unwrap().len();
                            let body = format!(
                                "{{\"inside\":{},\"rects\":{},\"cursor\":[{},{}],\"dragging\":{}}}",
                                inside,
                                n,
                                lx,
                                ly,
                                DRAGGING.load(Ordering::Relaxed)
                            );
                            let _ = std::fs::write(dir.join("clickdbg.json"), body);
                        }
                    }
                }
            });

            // Platform scan: top edges of every visible top-level window,
            // so the pet can sit on them. Emitted as logical-px [x, y, w].
            let handle2 = app.handle().clone();
            let own_w = msize.width as i32;
            let own_h = msize.height as i32;
            std::thread::spawn(move || loop {
                let rects = collect_window_rects(scale);
                let plats: Vec<[f64; 3]> = rects
                    .into_iter()
                    .filter(|r| {
                        !(r[0] == mpos.x
                            && r[1] == mpos.y
                            && r[2] - r[0] == own_w
                            && r[3] - r[1] == own_h)
                    })
                    .map(|r| {
                        [
                            (r[0] - mpos.x) as f64 / scale,
                            (r[1] - mpos.y) as f64 / scale,
                            (r[2] - r[0]) as f64 / scale,
                        ]
                    })
                    .collect();
                let _ = handle2.emit("platforms", plats);
                std::thread::sleep(Duration::from_millis(600));
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    // throwaway keypair for tests only — the shipped GEM_PUBKEY is never
    // exercised here, so no valid production code leaks via the test code
    const TEST_SK: [u8; 32] = [7; 32];

    fn test_pub() -> [u8; 32] {
        ed25519_dalek::SigningKey::from_bytes(&TEST_SK)
            .verifying_key()
            .to_bytes()
    }
    fn b32enc(bytes: &[u8]) -> String {
        const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let (mut out, mut acc, mut bits) = (String::new(), 0u64, 0u32);
        for b in bytes {
            acc = (acc << 8) | (*b as u64);
            bits += 8;
            while bits >= 5 {
                out.push(T[((acc >> (bits - 5)) & 31) as usize] as char);
                bits -= 5;
            }
        }
        if bits > 0 {
            out.push(T[((acc << (5 - bits)) & 31) as usize] as char);
        }
        out
    }
    fn mint(pack: &str, nonce: &str) -> String {
        use ed25519_dalek::Signer as _;
        let sk = ed25519_dalek::SigningKey::from_bytes(&TEST_SK);
        let sig = sk.sign(format!("JP2:{pack}:{nonce}").as_bytes());
        format!("JELLYPAL-{pack}-{nonce}-{}", b32enc(&sig.to_bytes()))
    }

    #[test]
    fn valid_code_returns_gems() {
        let pk = test_pub();
        assert_eq!(verify_code_with(&pk, &mint("C", "ABCDEFGH")).unwrap(), 1000);
        assert_eq!(verify_code_with(&pk, &mint("A", "ZZZZZZZZ")).unwrap(), 250);
    }
    #[test]
    fn pack_swap_forgery_rejected() {
        let pk = test_pub();
        // a legit pack-C code retyped as pack-D: sig covers the pack letter
        let forged = mint("C", "ABCDEFGH").replacen("JELLYPAL-C", "JELLYPAL-D", 1);
        assert!(verify_code_with(&pk, &forged).is_err());
    }
    #[test]
    fn wrong_key_rejects_valid_code() {
        let pk = [9u8; 32];
        assert!(verify_code_with(&pk, &mint("A", "ABCDEFGH")).is_err());
    }
    #[test]
    fn malformed_codes_rejected() {
        let pk = test_pub();
        assert!(verify_code_with(&pk, "JELLYPAL-A-XXXXXXXX-ZZZZ").is_err());
        assert!(verify_code_with(&pk, "not a code").is_err());
        assert!(verify_code_with(&pk, "JELLYPAL-E-ABCDEFGH-XXXX").is_err());
    }
}
