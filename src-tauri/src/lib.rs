use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use windows_sys::Win32::Foundation::{CloseHandle, HWND, LPARAM, POINT, RECT, TRUE};
use windows_sys::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetCursorPos, GetForegroundWindow, GetWindowRect,
    GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
};

// Rects (logical px, relative to our window) that should capture the mouse.
static CLICKABLE: Mutex<Vec<[f64; 4]>> = Mutex::new(Vec::new());
static DRAGGING: AtomicBool = AtomicBool::new(false);
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
    std::process::Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    // gem-shop store link — only ever https, opened in the default browser
    if !url.starts_with("https://") {
        return Err("refusing non-https url".into());
    }
    std::process::Command::new("explorer")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
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
    Ok(())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // seller diagnostic: `jellypal.exe --verify-code JELLYPAL-...` checks a
    // minted code against the embedded pubkey and exits — handy to confirm
    // a Stripe/Gumroad code really works before listing it
    let args: Vec<String> = std::env::args().collect();
    if let Some(pos) = args.iter().position(|a| a == "--verify-code") {
        // release builds are windows-subsystem — attach to the parent's
        // console or the answer never reaches the terminal
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

    // single instance: a second launch exits quietly instead of fighting
    // the first over the WebView2 user-data dir — that contention is what
    // froze the newcomer and made Windows mark it "not responding"
    unsafe {
        use windows_sys::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
        use windows_sys::Win32::System::Threading::CreateMutexW;
        let name: Vec<u16> = "Local\\JellypalSingleInstance\0".encode_utf16().collect();
        let h = CreateMutexW(std::ptr::null(), 1, name.as_ptr());
        if h.is_null() || GetLastError() == ERROR_ALREADY_EXISTS {
            std::process::exit(0);
        }
        // handle intentionally never closed — the kernel holds the mutex
        // for as long as this process lives, releasing it on exit
    }

    std::panic::set_hook(Box::new(|info| {
        let _ = std::fs::write("C:/dev/panic.log", format!("{info}"));
    }));

    tauri::Builder::default()
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

            let summon = MenuItem::with_id(app, "summon", "Summon", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&summon, &quit])?;
            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().unwrap().clone())
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
            // the Ctrl modifier so copy/paste/cut combos can be spotted
            // (combo detection only; typed content is never read).
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut ctrl = false;
                if let Err(e) = rdev::listen(move |event| {
                    match event.event_type {
                        rdev::EventType::KeyPress(k) => {
                            let _ = handle.emit("keystroke", ());
                            match k {
                                rdev::Key::ControlLeft | rdev::Key::ControlRight => ctrl = true,
                                rdev::Key::KeyC | rdev::Key::KeyX if ctrl => {
                                    let _ = handle.emit("copy", ());
                                }
                                rdev::Key::KeyV if ctrl => {
                                    let _ = handle.emit("paste", ());
                                }
                                _ => {}
                            }
                        }
                        rdev::EventType::KeyRelease(k) => {
                            if matches!(k, rdev::Key::ControlLeft | rdev::Key::ControlRight) {
                                ctrl = false;
                            }
                        }
                        _ => {}
                    }
                }) {
                    let _ =
                        std::fs::write("C:/dev/hook.log", format!("rdev listen failed: {e:?}"));
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
                        unsafe {
                            let hwnd = GetForegroundWindow();
                            let mut buf = [0u16; 512];
                            let n = GetWindowTextW(hwnd, buf.as_mut_ptr(), 512);
                            // process name too — titles alone can't tell a
                            // browser from a game
                            let mut exe = String::new();
                            let mut pid = 0u32;
                            GetWindowThreadProcessId(hwnd, &mut pid);
                            let hproc =
                                OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
                            if !hproc.is_null() {
                                let mut pbuf = [0u16; 512];
                                let mut len = 512u32;
                                if QueryFullProcessImageNameW(
                                    hproc, 0, pbuf.as_mut_ptr(), &mut len,
                                ) != 0
                                {
                                    let full = String::from_utf16_lossy(
                                        &pbuf[..len as usize],
                                    );
                                    exe = full
                                        .rsplit(['\\', '/'])
                                        .next()
                                        .unwrap_or("")
                                        .to_lowercase();
                                }
                                CloseHandle(hproc);
                            }
                            if n > 0 {
                                let title =
                                    String::from_utf16_lossy(&buf[..n as usize]);
                                let _ = win_poll.emit("focus", [title, exe]);
                            }
                        }
                    }
                    let mut pt = POINT { x: 0, y: 0 };
                    unsafe { GetCursorPos(&mut pt) };
                    let lx = (pt.x - mpos.x) as f64 / scale;
                    let ly = (pt.y - mpos.y) as f64 / scale;
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
                    if now_inside != inside {
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
                let mut rects: Vec<[i32; 4]> = Vec::new();
                unsafe {
                    EnumWindows(
                        Some(enum_windows_cb),
                        &mut rects as *mut Vec<[i32; 4]> as LPARAM,
                    );
                }
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
