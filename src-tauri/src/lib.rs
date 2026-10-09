use std::sync::atomic::{AtomicBool, Ordering};
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
// set while reset_save is wiping — an in-flight save_state landing after the
// deletes would resurrect the very save the user asked to destroy
static RESETTING: AtomicBool = AtomicBool::new(false);
// Serialize state generations with RESET. The flag rejects queued saves; the
// lock lets RESET wait for a save that already started, then delete last.
static SAVE_IO_LOCK: Mutex<()> = Mutex::new(());
// Crash reports can arrive close together (frame guard + invariant guard).
// Serialize rotation and append so neither writer can discard the other's
// diagnostic while compacting the log.
static CRASH_LOG_LOCK: Mutex<()> = Mutex::new(());
// Per-monitor usable rects in window-logical px [x, y, w, h], filled at
// setup. Work areas exclude the macOS Dock/menu bar and Windows taskbar.
static MON_LIST: Mutex<Vec<[f64; 4]>> = Mutex::new(Vec::new());
const MAX_CLICKABLE_RECTS: usize = 64;
const MAX_CLICKABLE_COORD: f64 = 1_000_000.0;
const MAX_FOCUS_TITLE_CHARS: usize = 512;
const MAX_FOCUS_APP_CHARS: usize = 256;

fn bounded_focus_text(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

// Real-executable smoke tests need a genuinely empty profile without ever
// moving or rewriting the player's save. Honor an override only when it is an
// absolute path carrying our explicit marker; an accidental environment value
// therefore falls back to Tauri's normal app-data directory.
fn test_data_dir() -> Option<std::path::PathBuf> {
    let dir = std::path::PathBuf::from(std::env::var_os("JELLYPAL_TEST_DATA_DIR")?);
    if dir.is_absolute() && dir.join(".jellypal-test-profile").is_file() {
        Some(dir)
    } else {
        None
    }
}

fn data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = if let Some(dir) = test_data_dir() {
        dir
    } else {
        app.path().app_data_dir().map_err(|e| e.to_string())?
    };
    ensure_data_dir(dir)
}

fn ensure_data_dir(dir: std::path::PathBuf) -> Result<std::path::PathBuf, String> {
    prepare_regular_dir_path(&dir, true).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn lock_recover<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    recover_lock_result(mutex.lock())
}

fn recover_lock_result<T>(
    result: std::sync::LockResult<std::sync::MutexGuard<'_, T>>,
) -> std::sync::MutexGuard<'_, T> {
    result.unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn required_runtime_value<T>(value: Option<T>, name: &str) -> std::io::Result<T> {
    value.ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("required runtime value is missing: {name}"),
        )
    })
}

#[tauri::command]
fn get_monitors() -> Vec<[f64; 4]> {
    lock_recover(&MON_LIST).clone()
}

fn sanitize_clickable_rects(rects: Vec<[f64; 4]>) -> Vec<[f64; 4]> {
    rects
        .into_iter()
        .filter(|r| {
            r.iter()
                .all(|n| n.is_finite() && n.abs() <= MAX_CLICKABLE_COORD)
                && r[2] > 0.0
                && r[3] > 0.0
        })
        .take(MAX_CLICKABLE_RECTS)
        .collect()
}

fn next_poll_tick(current: u32) -> u32 {
    current.wrapping_add(1)
}

fn next_held_stall(current: u32, diverged: bool, button_held: bool) -> u32 {
    if diverged && button_held {
        current.saturating_add(1)
    } else {
        0
    }
}

fn clickable_policy_self_test() -> bool {
    let valid = [[0.0, 1.0, 2.0, 3.0], [-10.0, -20.0, 30.0, 40.0]];
    let flood: Vec<[f64; 4]> = (0..MAX_CLICKABLE_RECTS + 10)
        .map(|n| [n as f64, 0.0, 1.0, 1.0])
        .collect();
    [
        sanitize_clickable_rects(vec![]).is_empty(),
        sanitize_clickable_rects(valid.to_vec()) == valid,
        sanitize_clickable_rects(vec![[f64::NAN, 0.0, 1.0, 1.0]]).is_empty(),
        sanitize_clickable_rects(vec![[0.0, f64::INFINITY, 1.0, 1.0]]).is_empty(),
        sanitize_clickable_rects(vec![[0.0, 0.0, 0.0, 1.0]]).is_empty(),
        sanitize_clickable_rects(vec![[0.0, 0.0, 1.0, 0.0]]).is_empty(),
        sanitize_clickable_rects(vec![[0.0, 0.0, -1.0, 1.0]]).is_empty(),
        sanitize_clickable_rects(vec![[0.0, 0.0, 1.0, -1.0]]).is_empty(),
        sanitize_clickable_rects(vec![[MAX_CLICKABLE_COORD + 1.0, 0.0, 1.0, 1.0]]).is_empty(),
        sanitize_clickable_rects(vec![[0.0, 0.0, MAX_CLICKABLE_COORD + 1.0, 1.0]]).is_empty(),
        sanitize_clickable_rects(vec![[
            -MAX_CLICKABLE_COORD,
            MAX_CLICKABLE_COORD,
            MAX_CLICKABLE_COORD,
            1.0,
        ]])
        .len()
            == 1,
        {
            let bounded = sanitize_clickable_rects(flood);
            bounded.len() == MAX_CLICKABLE_RECTS
                && bounded.last().map(|r| r[0]) == Some((MAX_CLICKABLE_RECTS - 1) as f64)
        },
        next_poll_tick(u32::MAX) == 0,
        next_held_stall(0, true, true) == 1,
        next_held_stall(u32::MAX, true, true) == u32::MAX,
        next_held_stall(42, false, true) == 0 && next_held_stall(42, true, false) == 0,
        {
            let mutex = Mutex::new(7u8);
            let guard = lock_recover(&mutex);
            let recovered = *recover_lock_result(Err(std::sync::PoisonError::new(guard)));
            recovered == 7
        },
        required_runtime_value(Some(7u8), "test").ok() == Some(7),
        required_runtime_value::<u8>(None, "test").is_err(),
    ]
    .into_iter()
    .all(|ok| ok)
}

#[tauri::command]
fn set_clickable(rects: Vec<[f64; 4]>) {
    *lock_recover(&CLICKABLE) = sanitize_clickable_rects(rects);
}

#[tauri::command]
fn set_dragging(on: bool) {
    DRAGGING.store(on, Ordering::Relaxed);
}

// ---- save at-rest protection ----
// state.json carries the wallet and the install uid, so it can't stay
// plaintext: a notepad edit is free jelly, and a copied uid lets a stranger
// scoop pending purchase grants first. On Windows the file is DPAPI-sealed
// (CryptProtectData) — keyed to this Windows account, so tampering fails
// decryption and a copied blob won't open on another machine or profile.
// This kills casual save editing; it is not DRM — someone who can call
// CryptProtectData under their own account can still forge a blob.
const SAVE_MAGIC: &str = "JPENC1:";
// A maximally populated, sanitized v2 save (1,000 hybrids, 64,000 top
// pixels, 2,000 redeem records) is under 2 MiB. Keep ample growth headroom
// while preventing a broken or hostile IPC call from sealing/writing an
// unbounded blob and displacing the last good generation.
const MAX_SAVE_BYTES: usize = 16 * 1024 * 1024;
// DPAPI + Base64 expansion puts a maximally valid plaintext save a little
// above 21 MiB. Bound on-disk reads too so a replaced/corrupt save cannot make
// boot or recovery allocate an arbitrary file.
const MAX_SAVE_FILE_BYTES: u64 = 24 * 1024 * 1024;
const MAX_CHECKPOINT_FILE_BYTES: u64 = 4 * 1024;

#[cfg(windows)]
fn dpapi_protect(data: &[u8]) -> Option<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB};
    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    unsafe {
        if CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            &mut out,
        ) == 0
        {
            return None;
        }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        windows_sys::Win32::Foundation::LocalFree(out.pbData as _);
        Some(v)
    }
}

#[cfg(windows)]
fn dpapi_unprotect(blob: &[u8]) -> Option<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};
    let input = CRYPT_INTEGER_BLOB {
        cbData: blob.len() as u32,
        pbData: blob.as_ptr() as *mut u8,
    };
    let mut out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    unsafe {
        if CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            &mut out,
        ) == 0
        {
            return None;
        }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        windows_sys::Win32::Foundation::LocalFree(out.pbData as _);
        Some(v)
    }
}

fn seal_save(json: &str) -> String {
    // The marker-gated clean-boot profile is disposable and its Node harness
    // must inspect the first-run payload. Keep production profiles DPAPI-sealed.
    if test_data_dir().is_some() {
        return json.to_string();
    }
    #[cfg(windows)]
    {
        if let Some(blob) = dpapi_protect(json.as_bytes()) {
            return format!("{}{}", SAVE_MAGIC, b64encode(&blob));
        }
    }
    json.to_string()
}

// returns None when the file is sealed and undecryptable — the caller falls
// through to .bak or a clean start, same as any other corruption
fn unseal_save(txt: &str) -> Option<String> {
    if let Some(rest) = txt.strip_prefix(SAVE_MAGIC) {
        #[cfg(windows)]
        {
            let blob = b64decode(rest.trim()).ok()?;
            let raw = dpapi_unprotect(&blob)?;
            return String::from_utf8(raw).ok();
        }
        #[cfg(not(windows))]
        {
            let _ = rest;
            return None; // windows-sealed blob on a mac — can't open it here
        }
    }
    Some(txt.to_string()) // legacy plaintext save — loads, re-seals on write
}

// ---- rollback checkpoint ----
// DPAPI stops edits, but not save-scumming: copy the folder, pull gacha,
// paste back on a bad pull. So each save also writes state.chk, a sealed
// {seq, cur, prev} where cur/prev are hashes of the two newest plaintext
// generations (state.json and its .bak), plus a registry watermark at
// HKCU\Software\JellyPal\sv. A loaded file must hash to a chk-listed
// generation and not lag the watermark: a single-file restore fails the
// hash match, a whole-folder restore lags sv, and deleting chk first trips
// the "sealed save but sv>0" rule. Still not DRM — someone who reseals all
// three beats it — but the casual copy-paste loop collapses to a clean
// start instead of a free retry.
static LAST_SAVE: Mutex<Option<String>> = Mutex::new(None);

// FNV-1a — the hash only binds a file to its sealed chk entry, so it needs
// to be stable, not cryptographic (a forged chk is a DPAPI problem, not a
// hashing one)
fn fnv64_bytes(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in bytes {
        h = (h ^ *b as u64).wrapping_mul(0x100000001b3);
    }
    h
}

fn fnv64(s: &str) -> u64 {
    fnv64_bytes(s.as_bytes())
}

// Decide whether a parsed plaintext generation belongs to the current save
// chain. A zero registry watermark means first boot or a deliberate reinstall
// (the uninstaller clears it), so a legacy/plain backup may be adopted. Once a
// watermark exists, deleting state.chk must never turn an edited plaintext
// file into an accepted "legacy" save.
fn save_generation_allowed(raw: &str, chk: Option<(u64, u64, Option<u64>)>, reg_seq: u64) -> bool {
    match chk {
        Some((seq, cur, prev)) => {
            let h = fnv64(raw);
            let generation = if h == cur {
                Some(seq)
            } else if prev == Some(h) {
                Some(seq.saturating_sub(1))
            } else {
                None
            };
            match generation {
                Some(g) => g.saturating_add(1) >= reg_seq,
                // Early saves once allowed an unknown generation so a fresh
                // reinstall could adopt a lone backup. That exception is safe
                // only after the watermark has actually been cleared.
                None => reg_seq == 0 && seq <= 2,
            }
        }
        None => reg_seq == 0,
    }
}

fn save_policy_self_test() -> bool {
    let current = "{\"jelly\":20}";
    let previous = "{\"jelly\":10}";
    let known = Some((7, fnv64(current), Some(fnv64(previous))));
    let early_unknown = Some((2, fnv64("different"), None));
    [
        save_generation_allowed(current, None, 0),
        !save_generation_allowed("{\"jelly\":99999}", None, 1),
        save_generation_allowed(current, known, 7),
        save_generation_allowed(previous, known, 7),
        !save_generation_allowed(previous, known, 8),
        save_generation_allowed("backup", early_unknown, 0),
        !save_generation_allowed("forged", early_unknown, 1),
        !save_generation_allowed("backup", Some((3, fnv64("different"), None)), 0),
    ]
    .into_iter()
    .all(|ok| ok)
}

fn validate_save_payload(json: &str) -> Result<(), String> {
    if json.len() > MAX_SAVE_BYTES {
        return Err("save payload exceeds 16 MiB".into());
    }
    let value: serde_json::Value =
        serde_json::from_str(json).map_err(|_| "save payload is not valid JSON".to_string())?;
    if !value.is_object() {
        return Err("save payload root must be an object".into());
    }
    Ok(())
}

fn load_generation_allowed(raw: &str, chk: Option<(u64, u64, Option<u64>)>, reg_seq: u64) -> bool {
    validate_save_payload(raw).is_ok() && save_generation_allowed(raw, chk, reg_seq)
}

fn load_generation_self_test() -> [bool; 4] {
    let object = "{\"jelly\":20}";
    let known = Some((7, fnv64(object), None));
    [
        load_generation_allowed(object, known, 7),
        !load_generation_allowed("null", Some((7, fnv64("null"), None)), 7),
        !load_generation_allowed("[]", Some((7, fnv64("[]"), None)), 7),
        !load_generation_allowed("\"text\"", Some((7, fnv64("\"text\""), None)), 7),
    ]
}

fn save_payload_self_test() -> bool {
    let shell_len = r#"{"pad":""}"#.len();
    let exact = format!(r#"{{"pad":"{}"}}"#, "x".repeat(MAX_SAVE_BYTES - shell_len));
    let exact_ok = exact.len() == MAX_SAVE_BYTES && validate_save_payload(&exact).is_ok();
    drop(exact);
    let oversized = "x".repeat(MAX_SAVE_BYTES + 1);
    [
        validate_save_payload("{}").is_ok(),
        validate_save_payload(" \n {\"ver\":2,\"hybrids\":[]} \t").is_ok(),
        validate_save_payload("").is_err(),
        validate_save_payload("{\"broken\":").is_err(),
        validate_save_payload("null").is_err(),
        validate_save_payload("[]").is_err(),
        validate_save_payload("42").is_err(),
        exact_ok,
        matches!(validate_save_payload(&oversized), Err(e) if e.contains("exceeds")),
    ]
    .into_iter()
    .all(|ok| ok)
}

fn regular_file_exists(path: &std::path::Path) -> std::io::Result<bool> {
    match std::fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_file() && !migration_reparse(&meta) => Ok(true),
        Ok(_) => Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "save path is not a regular file",
        )),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e),
    }
}

fn read_regular_file(path: &std::path::Path, max_bytes: u64) -> std::io::Result<Vec<u8>> {
    let meta = std::fs::symlink_metadata(path)?;
    if !meta.file_type().is_file() || migration_reparse(&meta) || meta.len() > max_bytes {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "save file is not a bounded regular file",
        ));
    }
    let file = std::fs::OpenOptions::new().read(true).open(path)?;
    let opened = file.metadata()?;
    if !opened.file_type().is_file() || migration_reparse(&opened) || opened.len() > max_bytes {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "opened save file is not a bounded regular file",
        ));
    }
    read_bounded(file, max_bytes)
}

fn read_bounded<R: std::io::Read>(reader: R, max_bytes: u64) -> std::io::Result<Vec<u8>> {
    use std::io::Read as _;

    let mut bytes = Vec::with_capacity(max_bytes.min(8 * 1024) as usize);
    reader
        .take(max_bytes.saturating_add(1))
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > max_bytes {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "file grew beyond policy while reading",
        ));
    }
    Ok(bytes)
}

fn read_regular_text(path: &std::path::Path, max_bytes: u64) -> std::io::Result<String> {
    String::from_utf8(read_regular_file(path, max_bytes)?)
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "save file is not UTF-8"))
}

fn write_create_new(path: &std::path::Path, data: &[u8]) -> std::io::Result<()> {
    use std::io::Write as _;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    file.write_all(data)
}

fn remove_file_leaf_no_follow(path: &std::path::Path) -> std::io::Result<()> {
    let meta = match std::fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e),
    };
    if migration_reparse(&meta) {
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x10;
            if meta.file_attributes() & FILE_ATTRIBUTE_DIRECTORY != 0 {
                return std::fs::remove_dir(path);
            }
            return std::fs::remove_file(path);
        }
        #[cfg(not(windows))]
        {
            return std::fs::remove_file(path);
        }
    }
    if meta.file_type().is_file() {
        std::fs::remove_file(path)
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "temporary file leaf is not a regular file",
        ))
    }
}

fn write_fresh_file(path: &std::path::Path, data: &[u8]) -> std::io::Result<()> {
    // Removing an existing hard link/symlink unlinks this directory entry;
    // opening it for truncation could modify the external target instead.
    remove_file_leaf_no_follow(path)?;
    write_create_new(path, data)
}

fn replace_regular_file(tmp: &std::path::Path, dest: &std::path::Path) -> std::io::Result<()> {
    let _ = regular_file_exists(tmp)?;
    let _ = regular_file_exists(dest)?;
    std::fs::rename(tmp, dest)
}

fn write_atomic_regular(path: &std::path::Path, data: &[u8]) -> std::io::Result<()> {
    let name = path.file_name().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "file path has no leaf")
    })?;
    let mut tmp_name = name.to_os_string();
    tmp_name.push(".tmp");
    let tmp = path.with_file_name(tmp_name);
    write_fresh_file(&tmp, data)?;
    if let Err(e) = replace_regular_file(&tmp, path) {
        let _ = remove_file_leaf_no_follow(&tmp);
        return Err(e);
    }
    Ok(())
}

// Preserve rejected generations before the frontend starts a clean ranch and
// eventually overwrites state.json. Content-derived names make repeated boots
// idempotent while keeping every distinct rejected generation available for
// manual support/recovery.
fn preserve_rejected_save(dir: &std::path::Path) -> usize {
    let recovery = dir.join("recovery");
    let mut copied = 0;
    let mut recovery_ready = false;
    for (name, label, max_bytes) in [
        ("state.json", "state", MAX_SAVE_FILE_BYTES),
        ("state.json.bak", "backup", MAX_SAVE_FILE_BYTES),
        ("state.chk", "checkpoint", MAX_CHECKPOINT_FILE_BYTES),
    ] {
        let src = dir.join(name);
        // A corrupt save is exactly what this path is meant to preserve.
        // Hash bytes instead of decoding UTF-8 so even a partially written or
        // otherwise malformed artifact survives byte-for-byte for support.
        let Ok(bytes) = read_regular_file(&src, max_bytes) else {
            continue;
        };
        if !recovery_ready && prepare_regular_dir_path(&recovery, true).is_err() {
            continue;
        }
        recovery_ready = true;
        let dest = recovery.join(format!("rejected-{label}-{:016x}.txt", fnv64_bytes(&bytes)));
        match std::fs::symlink_metadata(&dest) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                if write_create_new(&dest, &bytes).is_ok() {
                    copied += 1;
                }
            }
            _ => {}
        }
    }
    if recovery_ready {
        let note = recovery.join("README.txt");
        if std::fs::symlink_metadata(&note).is_err() {
            let _ = write_create_new(
                &note,
                "Jellypal rejected these save generations because their checkpoint or rollback watermark did not match.\nThey were not loaded. Keep them for manual support/recovery; Settings > RESET removes this folder.\n"
                    .as_bytes(),
            );
        }
    }
    copied
}

fn recovery_self_test() -> bool {
    let root = std::env::temp_dir().join(format!("jellypal-save-recovery-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    if std::fs::create_dir_all(&root).is_err() {
        return false;
    }
    let state = "{\"jelly\":99999}";
    let backup = [0xff, 0x00, 0xfe, b'J', b'P'];
    let checkpoint = "sealed-checkpoint";
    let wrote = std::fs::write(root.join("state.json"), state).is_ok()
        && std::fs::write(root.join("state.json.bak"), backup).is_ok()
        && std::fs::write(root.join("state.chk"), checkpoint).is_ok();
    let first = if wrote {
        preserve_rejected_save(&root)
    } else {
        0
    };
    let recovery = root.join("recovery");
    let checks = [
        first == 3,
        std::fs::read_to_string(recovery.join(format!("rejected-state-{:016x}.txt", fnv64(state))))
            .ok()
            .as_deref()
            == Some(state),
        std::fs::read(recovery.join(format!("rejected-backup-{:016x}.txt", fnv64_bytes(&backup))))
            .ok()
            .as_deref()
            == Some(backup.as_slice()),
        std::fs::read_to_string(recovery.join(format!(
            "rejected-checkpoint-{:016x}.txt",
            fnv64(checkpoint)
        )))
        .ok()
        .as_deref()
            == Some(checkpoint),
        std::fs::read_to_string(recovery.join("README.txt"))
            .map(|note| note.contains("rejected") && note.contains("RESET"))
            .unwrap_or(false),
        preserve_rejected_save(&root) == 0,
    ];
    let _ = std::fs::remove_dir_all(&root);
    checks.into_iter().all(|ok| ok)
}

fn save_filesystem_self_test() -> bool {
    let root = std::env::temp_dir().join(format!(
        "jellypal-save-filesystem-policy-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let data = root.join("data");
    let outside = root.join("outside");
    let root_seeded = std::fs::create_dir_all(&data).is_ok()
        && std::fs::create_dir(&outside).is_ok()
        && std::fs::write(outside.join("keep.txt"), b"KEEP").is_ok();

    let bounded = data.join("bounded");
    let bounded_seeded = std::fs::write(&bounded, b"ABCD").is_ok();
    let bounded_exact = read_regular_file(&bounded, 4).ok().as_deref() == Some(b"ABCD");
    let bounded_rejected = read_regular_file(&bounded, 3).is_err();
    let stream_exact = read_bounded(std::io::Cursor::new(b"ABCD"), 4)
        .ok()
        .as_deref()
        == Some(b"ABCD");
    let stream_overflow = read_bounded(std::io::Cursor::new(b"ABCDE"), 4).is_err();
    let blocked_tmp = data.join("blocked.tmp");
    let temp_dir_seeded = std::fs::create_dir(&blocked_tmp).is_ok()
        && std::fs::write(blocked_tmp.join("keep.txt"), b"KEEP").is_ok();
    let temp_dir_rejected = write_fresh_file(&blocked_tmp, b"NOPE").is_err();
    let temp_dir_preserved =
        std::fs::read(blocked_tmp.join("keep.txt")).ok().as_deref() == Some(b"KEEP");
    let directory = data.join("directory");
    let directory_rejected = std::fs::create_dir(&directory).is_ok()
        && regular_file_exists(&directory).is_err()
        && read_regular_file(&directory, 10).is_err();

    let stale_tmp = data.join("state.json.tmp");
    let tmp_link_seeded = std::fs::hard_link(outside.join("keep.txt"), &stale_tmp).is_ok();
    let tmp_rewritten = write_fresh_file(&stale_tmp, b"LOCAL").is_ok()
        && std::fs::read(&stale_tmp).ok().as_deref() == Some(b"LOCAL");
    let outside_after_tmp =
        std::fs::read(outside.join("keep.txt")).ok().as_deref() == Some(b"KEEP");

    let state = data.join("state.json");
    let target_link_seeded = std::fs::hard_link(outside.join("keep.txt"), &state).is_ok();
    let replacement_tmp = data.join("replacement.tmp");
    let replacement_seeded = write_fresh_file(&replacement_tmp, b"NEW").is_ok()
        && replace_regular_file(&replacement_tmp, &state).is_ok();
    let target_replaced = std::fs::read(&state).ok().as_deref() == Some(b"NEW");
    let outside_after_replace =
        std::fs::read(outside.join("keep.txt")).ok().as_deref() == Some(b"KEEP");

    let recovery = data.join("recovery");
    let recovery_link_created = create_migration_test_link(&recovery, &outside);
    let recovery_rejected = preserve_rejected_save(&data) == 0;
    let outside_after_recovery = std::fs::read(outside.join("keep.txt")).ok().as_deref()
        == Some(b"KEEP")
        && !outside.join("README.txt").exists();
    let recovery_link_removed = remove_tree_no_follow(&recovery).is_ok() && !recovery.exists();
    let recovery_copied = preserve_rejected_save(&data) == 1;
    let recovered = recovery.join(format!("rejected-state-{:016x}.txt", fnv64_bytes(b"NEW")));
    let recovered_exact = std::fs::read(recovered).ok().as_deref() == Some(b"NEW");
    let recovery_idempotent = preserve_rejected_save(&data) == 0;

    let invalid_text = data.join("invalid-text");
    let invalid_text_rejected = std::fs::write(&invalid_text, [0xff]).is_ok()
        && read_regular_text(&invalid_text, 1).is_err();
    let absent_is_false = matches!(regular_file_exists(&data.join("absent")), Ok(false));
    let serialization = save_serialization_self_test();
    let checks = [
        root_seeded,
        bounded_seeded,
        bounded_exact,
        bounded_rejected,
        stream_exact,
        stream_overflow,
        temp_dir_seeded,
        temp_dir_rejected,
        temp_dir_preserved,
        directory_rejected,
        tmp_link_seeded,
        tmp_rewritten,
        outside_after_tmp,
        target_link_seeded,
        replacement_seeded,
        target_replaced,
        outside_after_replace,
        recovery_link_created,
        recovery_rejected,
        outside_after_recovery,
        recovery_link_removed,
        recovery_copied,
        recovered_exact,
        recovery_idempotent,
        invalid_text_rejected,
        absent_is_false,
        serialization[0],
        serialization[1],
        serialization[2],
    ];
    let _ = remove_tree_no_follow(&recovery);
    let _ = std::fs::remove_dir_all(&root);
    checks.into_iter().all(|ok| ok)
}

fn save_serialization_self_test() -> [bool; 3] {
    use std::sync::atomic::AtomicBool as TestAtomicBool;
    use std::sync::mpsc;
    use std::sync::Arc;

    RESETTING.store(false, Ordering::SeqCst);
    let artifact = Arc::new(TestAtomicBool::new(false));
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let in_flight_artifact = Arc::clone(&artifact);
    let in_flight = std::thread::spawn(move || {
        let _guard = lock_recover(&SAVE_IO_LOCK);
        let allowed = !RESETTING.load(Ordering::SeqCst);
        let _ = started_tx.send(allowed);
        let _ = release_rx.recv_timeout(Duration::from_secs(2));
        if allowed {
            in_flight_artifact.store(true, Ordering::Relaxed);
        }
    });
    let in_flight_allowed = started_rx
        .recv_timeout(Duration::from_secs(2))
        .unwrap_or(false);
    RESETTING.store(true, Ordering::SeqCst);
    let _ = release_tx.send(());
    {
        let _reset_guard = lock_recover(&SAVE_IO_LOCK);
        artifact.store(false, Ordering::Relaxed);
    }
    let in_flight_joined = in_flight.join().is_ok();
    let reset_won = in_flight_joined && !artifact.load(Ordering::Relaxed);

    RESETTING.store(false, Ordering::SeqCst);
    artifact.store(false, Ordering::Relaxed);
    let reset_guard = lock_recover(&SAVE_IO_LOCK);
    RESETTING.store(true, Ordering::SeqCst);
    let queued_artifact = Arc::clone(&artifact);
    let queued = std::thread::spawn(move || {
        let _guard = lock_recover(&SAVE_IO_LOCK);
        if !RESETTING.load(Ordering::SeqCst) {
            queued_artifact.store(true, Ordering::Relaxed);
        }
    });
    drop(reset_guard);
    let queued_joined = queued.join().is_ok();
    let queued_blocked = queued_joined && !artifact.load(Ordering::Relaxed);
    RESETTING.store(false, Ordering::SeqCst);

    [in_flight_allowed, reset_won, queued_blocked]
}

#[cfg(test)]
mod save_policy_tests {
    use super::{fnv64, save_generation_allowed};

    #[test]
    fn checkpointless_save_requires_zero_watermark() {
        assert!(save_generation_allowed("{\"jelly\":1}", None, 0));
        assert!(!save_generation_allowed("{\"jelly\":99999}", None, 1));
        assert!(!save_generation_allowed("{\"jelly\":99999}", None, 50));
    }

    #[test]
    fn current_and_one_previous_generation_are_accepted() {
        let current = "{\"jelly\":20}";
        let previous = "{\"jelly\":10}";
        let chk = Some((7, fnv64(current), Some(fnv64(previous))));
        assert!(save_generation_allowed(current, chk, 7));
        assert!(save_generation_allowed(previous, chk, 7));
        assert!(!save_generation_allowed(previous, chk, 8));
    }

    #[test]
    fn unknown_early_generation_only_adopts_after_reinstall() {
        let chk = Some((2, fnv64("different"), None));
        assert!(save_generation_allowed("backup", chk, 0));
        assert!(!save_generation_allowed("forged", chk, 1));
        assert!(!save_generation_allowed(
            "backup",
            Some((3, fnv64("different"), None)),
            0
        ));
    }
}

fn read_chk(dir: &std::path::Path) -> Option<(u64, u64, Option<u64>)> {
    let txt = read_regular_text(&dir.join("state.chk"), MAX_CHECKPOINT_FILE_BYTES).ok()?;
    let raw = unseal_save(&txt)?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let seq = v.get("seq")?.as_u64()?;
    let cur = v.get("cur")?.as_u64()?;
    let prev = v.get("prev").and_then(|x| x.as_u64());
    Some((seq, cur, prev))
}

fn next_save_seq(current: Option<u64>) -> Result<u64, String> {
    current
        .unwrap_or(0)
        .checked_add(1)
        .ok_or_else(|| "save checkpoint sequence exhausted".to_string())
}

fn save_sequence_self_test() -> [bool; 3] {
    [
        next_save_seq(None) == Ok(1),
        next_save_seq(Some(41)) == Ok(42),
        next_save_seq(Some(u64::MAX)).is_err(),
    ]
}

// written after the state.json rename succeeds, so chk never advertises a
// generation that didn't land. order matters: a chk write that fails leaves
// chk one generation back, which still verifies .bak on the next load
fn write_chk(
    dir: &std::path::Path,
    cur_plain: &str,
    prev_plain: Option<&str>,
) -> Result<(), String> {
    let seq = next_save_seq(read_chk(dir).map(|c| c.0))?;
    let body = serde_json::json!({
        "seq": seq,
        "cur": fnv64(cur_plain),
        "prev": prev_plain.map(fnv64),
    })
    .to_string();
    let tmp = dir.join("state.chk.tmp");
    let sealed = seal_save(&body);
    write_fresh_file(&tmp, sealed.as_bytes()).map_err(|e| e.to_string())?;
    replace_regular_file(&tmp, &dir.join("state.chk")).map_err(|e| e.to_string())?;
    reg_write_seq(seq)?;
    Ok(())
}

fn registry_status(code: u32, missing_ok: bool, operation: &str) -> Result<(), String> {
    if code == 0 || (missing_ok && code == 2) {
        Ok(())
    } else {
        Err(format!("{operation} failed ({code})"))
    }
}

fn autostart_key_status(code: u32) -> Result<bool, String> {
    if code == 0 {
        Ok(true)
    } else if code == 2 {
        // Turning startup off is idempotent: a missing Run key already means
        // the requested state has been reached.
        Ok(false)
    } else {
        Err(format!("autostart registry key open failed ({code})"))
    }
}

fn autostart_value_status(code: u32) -> Result<(), String> {
    // Deleting an absent value is also a successful transition to OFF.
    registry_status(code, true, "autostart registry value delete")
}

fn autostart_registry_status_self_test() -> [bool; 6] {
    [
        autostart_key_status(0) == Ok(true),
        autostart_key_status(2) == Ok(false),
        autostart_key_status(5).is_err(),
        autostart_value_status(0).is_ok(),
        autostart_value_status(2).is_ok(),
        autostart_value_status(5).is_err(),
    ]
}

fn xml_escape_text(text: &str) -> Result<String, String> {
    let mut escaped = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&apos;"),
            '\u{9}' | '\u{a}' | '\u{d}' => escaped.push(ch),
            '\u{20}'..='\u{d7ff}' | '\u{e000}'..='\u{fffd}' | '\u{10000}'..='\u{10ffff}' => {
                escaped.push(ch)
            }
            _ => return Err("autostart path contains a character XML cannot represent".into()),
        }
    }
    Ok(escaped)
}

fn launch_agent_plist(executable: &str) -> Result<String, String> {
    let executable = xml_escape_text(executable)?;
    Ok(format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
         <plist version=\"1.0\"><dict>\n\
         <key>Label</key><string>com.jellypal.desktop</string>\n\
         <key>ProgramArguments</key><array><string>{executable}</string></array>\n\
         <key>RunAtLoad</key><true/>\n\
         </dict></plist>\n"
    ))
}

fn autostart_xml_self_test() -> [bool; 10] {
    [
        xml_escape_text("/Applications/Jellypal.app")
            == Ok("/Applications/Jellypal.app".to_string()),
        xml_escape_text("A&B<C>D") == Ok("A&amp;B&lt;C&gt;D".to_string()),
        xml_escape_text("\"quoted\" 'path'")
            == Ok("&quot;quoted&quot; &apos;path&apos;".to_string()),
        xml_escape_text("&amp;") == Ok("&amp;amp;".to_string()),
        xml_escape_text("tab\tline\nreturn\r") == Ok("tab\tline\nreturn\r".to_string()),
        xml_escape_text("bad\u{1}").is_err(),
        xml_escape_text("bad\u{fffe}").is_err(),
        launch_agent_plist("/Applications/Jellypal.app/Contents/MacOS/jellypal").is_ok_and(
            |body| {
                body.contains(
                    "<key>ProgramArguments</key><array><string>/Applications/Jellypal.app/Contents/MacOS/jellypal</string></array>",
                ) && body.contains("<key>RunAtLoad</key><true/>")
            },
        ),
        launch_agent_plist("/Users/A&B/<Jellypal>")
            .is_ok_and(|body| body.contains("<string>/Users/A&amp;B/&lt;Jellypal&gt;</string>")),
        launch_agent_plist("bad\u{1}").is_err(),
    ]
}

#[cfg(windows)]
fn set_windows_autostart(enable: bool) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegOpenKeyExW, RegSetValueExW,
        HKEY_CURRENT_USER, KEY_SET_VALUE, REG_SZ,
    };

    let sub: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Run"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    let name: Vec<u16> = "Jellypal"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    let command = if enable {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let mut data = Vec::with_capacity(exe.as_os_str().encode_wide().count() + 3);
        data.push('"' as u16);
        data.extend(exe.as_os_str().encode_wide());
        data.push('"' as u16);
        data.push(0);
        Some(data)
    } else {
        None
    };

    unsafe {
        let mut key = std::ptr::null_mut();
        if enable {
            let rc = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                sub.as_ptr(),
                0,
                std::ptr::null(),
                0,
                KEY_SET_VALUE,
                std::ptr::null(),
                &mut key,
                std::ptr::null_mut(),
            );
            registry_status(rc, false, "autostart registry key create")?;
            if key.is_null() {
                return Err("autostart registry key create returned no handle".into());
            }

            let data = command
                .as_deref()
                .ok_or_else(|| "autostart command is unavailable".to_string())?;
            let rc = RegSetValueExW(
                key,
                name.as_ptr(),
                0,
                REG_SZ,
                data.as_ptr() as _,
                (data.len() * std::mem::size_of::<u16>()) as u32,
            );
            RegCloseKey(key);
            registry_status(rc, false, "autostart registry value write")
        } else {
            let rc = RegOpenKeyExW(HKEY_CURRENT_USER, sub.as_ptr(), 0, KEY_SET_VALUE, &mut key);
            if !autostart_key_status(rc)? {
                return Ok(());
            }
            if key.is_null() {
                return Err("autostart registry key open returned no handle".into());
            }
            let rc = RegDeleteValueW(key, name.as_ptr());
            RegCloseKey(key);
            autostart_value_status(rc)
        }
    }
}

fn registry_status_self_test() -> [bool; 4] {
    [
        registry_status(0, false, "write").is_ok(),
        registry_status(5, false, "write").is_err(),
        registry_status(2, true, "clear").is_ok(),
        registry_status(5, true, "clear").is_err(),
    ]
}

fn parse_registry_seq(units: &[u16]) -> Result<u64, String> {
    let end = units
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(units.len());
    let text = String::from_utf16(&units[..end])
        .map_err(|_| "save registry watermark is not valid UTF-16".to_string())?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("save registry watermark is empty".into());
    }
    trimmed
        .parse::<u64>()
        .map_err(|_| "save registry watermark is not a valid sequence".to_string())
}

fn registry_value_self_test() -> [bool; 4] {
    let max = format!("{}\0", u64::MAX).encode_utf16().collect::<Vec<_>>();
    [
        parse_registry_seq(&"42\0".encode_utf16().collect::<Vec<_>>()) == Ok(42),
        parse_registry_seq(&max) == Ok(u64::MAX),
        parse_registry_seq(&[0]).is_err(),
        parse_registry_seq(&"12x\0".encode_utf16().collect::<Vec<_>>()).is_err(),
    ]
}

#[cfg(windows)]
fn reg_key(create: bool) -> Result<Option<windows_sys::Win32::System::Registry::HKEY>, String> {
    use windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND;
    use windows_sys::Win32::System::Registry::{
        RegCreateKeyExW, RegOpenKeyExW, HKEY_CURRENT_USER, KEY_READ, KEY_WRITE,
    };
    let sub: Vec<u16> = "Software\\JellyPal"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        let mut key = std::ptr::null_mut();
        let rc = if create {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                sub.as_ptr(),
                0,
                std::ptr::null(),
                0,
                KEY_WRITE,
                std::ptr::null_mut(),
                &mut key,
                std::ptr::null_mut(),
            )
        } else {
            RegOpenKeyExW(HKEY_CURRENT_USER, sub.as_ptr(), 0, KEY_READ, &mut key)
        };
        if rc == 0 {
            Ok(Some(key))
        } else if !create && rc == ERROR_FILE_NOT_FOUND {
            Ok(None)
        } else {
            Err(format!("save registry key open failed ({rc})"))
        }
    }
}

#[cfg(windows)]
fn reg_write_seq(seq: u64) -> Result<(), String> {
    use windows_sys::Win32::System::Registry::{RegCloseKey, RegSetValueExW, REG_SZ};
    if test_data_dir().is_some() {
        return Ok(());
    }
    let Some(key) = reg_key(true)? else {
        return Err("save registry key create returned no handle".into());
    };
    let rc = unsafe {
        let name: Vec<u16> = "sv".encode_utf16().chain(std::iter::once(0)).collect();
        let data: Vec<u16> = seq
            .to_string()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let rc = RegSetValueExW(
            key,
            name.as_ptr(),
            0,
            REG_SZ,
            data.as_ptr() as _,
            (data.len() * 2) as u32,
        );
        RegCloseKey(key);
        rc
    };
    registry_status(rc, false, "save registry watermark write")
}

#[cfg(windows)]
fn reg_read_seq() -> Result<u64, String> {
    use windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND;
    use windows_sys::Win32::System::Registry::{RegCloseKey, RegQueryValueExW, REG_SZ};
    if test_data_dir().is_some() {
        return Ok(0);
    }
    let Some(key) = reg_key(false)? else {
        return Ok(0);
    };
    unsafe {
        let name: Vec<u16> = "sv".encode_utf16().chain(std::iter::once(0)).collect();
        let mut buf = [0u16; 32];
        let mut len = (buf.len() * 2) as u32;
        let mut ty = 0u32;
        let rc = RegQueryValueExW(
            key,
            name.as_ptr(),
            std::ptr::null(),
            &mut ty,
            buf.as_mut_ptr() as _,
            &mut len,
        );
        RegCloseKey(key);
        if rc == ERROR_FILE_NOT_FOUND {
            return Ok(0);
        }
        registry_status(rc, false, "save registry watermark read")?;
        if ty != REG_SZ || len == 0 || len as usize > buf.len() * 2 || len % 2 != 0 {
            return Err("save registry watermark has an invalid type or length".into());
        }
        parse_registry_seq(&buf[..len as usize / 2])
    }
}

#[cfg(windows)]
fn reg_clear() -> Result<(), String> {
    use windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND;
    use windows_sys::Win32::System::Registry::{RegDeleteKeyW, HKEY_CURRENT_USER};
    if test_data_dir().is_some() {
        return Ok(());
    }
    let rc = unsafe {
        let sub: Vec<u16> = "Software\\JellyPal"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        RegDeleteKeyW(HKEY_CURRENT_USER, sub.as_ptr())
    };
    registry_status(rc, rc == ERROR_FILE_NOT_FOUND, "reset registry cleanup")
}

#[cfg(not(windows))]
fn reg_write_seq(_: u64) -> Result<(), String> {
    Ok(())
}
#[cfg(not(windows))]
fn reg_read_seq() -> Result<u64, String> {
    Ok(0)
}
#[cfg(not(windows))]
fn reg_clear() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn save_state(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let _save_guard = lock_recover(&SAVE_IO_LOCK);
    if RESETTING.load(Ordering::SeqCst) {
        return Ok(());
    }
    // Validate before touching state.json.tmp or the last-good backup. An
    // invalid frontend payload must fail closed without advancing the save
    // chain or displacing either accepted generation.
    validate_save_payload(&json)?;
    let dir = data_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let state = dir.join("state.json");
    let tmp = dir.join("state.json.tmp");
    let backup = dir.join("state.json.bak");
    let backup_tmp = dir.join("state.json.bak.tmp");
    let checkpoint = dir.join("state.chk");
    // Validate every persistent destination before changing a generation.
    // Missing files are fine; directories/reparse entries fail closed.
    let had_state = regular_file_exists(&state).map_err(|e| e.to_string())?;
    let _ = regular_file_exists(&backup).map_err(|e| e.to_string())?;
    let had_checkpoint = regular_file_exists(&checkpoint).map_err(|e| e.to_string())?;
    if had_checkpoint {
        let _ =
            read_regular_file(&checkpoint, MAX_CHECKPOINT_FILE_BYTES).map_err(|e| e.to_string())?;
    }
    // write to a temp file first so a crash mid-write can't corrupt the save;
    // keep the previous good state as .bak for load_state to fall back on
    let sealed = seal_save(&json);
    write_fresh_file(&tmp, sealed.as_bytes()).map_err(|e| e.to_string())?;
    if had_state {
        let old = read_regular_file(&state, MAX_SAVE_FILE_BYTES).map_err(|e| e.to_string())?;
        write_fresh_file(&backup_tmp, &old).map_err(|e| e.to_string())?;
        replace_regular_file(&backup_tmp, &backup).map_err(|e| e.to_string())?;
    }
    replace_regular_file(&tmp, &state).map_err(|e| e.to_string())?;
    // advance the rollback checkpoint last — chk.reg only attest generations
    // that actually landed, so a crash here just leaves chk one gen behind
    // and the next load falls back to .bak instead of wiping
    let prev = if had_state {
        lock_recover(&LAST_SAVE).clone()
    } else {
        None
    };
    write_chk(&dir, &json, prev.as_deref())?;
    *lock_recover(&LAST_SAVE) = Some(json);
    Ok(())
}

#[tauri::command]
fn load_state(app: tauri::AppHandle) -> Result<String, String> {
    let _save_guard = lock_recover(&SAVE_IO_LOCK);
    let dir = data_dir(&app)?;
    // fall back to the last-good backup if the main save won't parse (or an
    // edited blob won't decrypt — tampering looks exactly like corruption)
    let chk = read_chk(&dir);
    let reg_seq = reg_read_seq()?;
    for name in ["state.json", "state.json.bak"] {
        if let Ok(txt) = read_regular_text(&dir.join(name), MAX_SAVE_FILE_BYTES) {
            let Some(raw) = unseal_save(&txt) else {
                continue;
            };
            // The file must belong to one of the two newest checkpointed
            // generations and not lag the registry watermark. A missing chk
            // adopts legacy/plain backups only on a true first boot/reinstall
            // (watermark 0), never merely because an attacker changed format.
            let ok = load_generation_allowed(&raw, chk, reg_seq);
            if ok {
                *lock_recover(&LAST_SAVE) = Some(raw.clone());
                return Ok(raw);
            }
        }
    }
    preserve_rejected_save(&dir);
    Ok("{}".into())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// RESET owns these exact leaf paths, but the photos/recovery/legacy folders
// are externally reachable and may have been replaced with a link or Windows
// junction. Unlink a reparse entry itself instead of recursively traversing
// its target. Rust's remove_dir_all applies the same no-follow rule to nested
// links; the shipped reset policy test locks both root and nested cases down.
fn remove_tree_no_follow(path: &std::path::Path) -> std::io::Result<()> {
    let meta = match std::fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e),
    };
    if migration_reparse(&meta) {
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x10;
            if meta.file_attributes() & FILE_ATTRIBUTE_DIRECTORY != 0 {
                return std::fs::remove_dir(path);
            }
            return std::fs::remove_file(path);
        }
        #[cfg(not(windows))]
        {
            return std::fs::remove_file(path);
        }
    }
    if meta.is_dir() {
        std::fs::remove_dir_all(path)
    } else if meta.is_file() {
        std::fs::remove_file(path)
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "reset target is not a regular file or directory",
        ))
    }
}

fn reset_data_paths_with<F>(
    dir: &std::path::Path,
    include_legacy: bool,
    mut remove: F,
) -> Result<(), String>
where
    F: FnMut(&std::path::Path) -> std::io::Result<()>,
{
    for name in [
        "state.json",
        "state.json.bak",
        "state.json.tmp",
        "state.json.bak.tmp",
        "state.chk",
        "state.chk.tmp",
        "photos",
        "recovery",
    ] {
        remove(&dir.join(name)).map_err(|e| format!("reset could not remove {name}: {e}"))?;
    }
    if include_legacy {
        let roaming = dir
            .parent()
            .ok_or_else(|| "reset data directory has no parent".to_string())?;
        for legacy in ["com.jellypal.app", "com.typet.app"] {
            remove(&roaming.join(legacy))
                .map_err(|e| format!("reset could not remove {legacy}: {e}"))?;
        }
    }
    Ok(())
}

fn reset_plan_self_test() -> [bool; 3] {
    let dir = std::path::PathBuf::from("jellypal-reset-plan-root").join("current");
    let mut visited = Vec::new();
    let complete = reset_data_paths_with(&dir, true, |path| {
        visited.push(path.to_path_buf());
        Ok(())
    });
    let exact_plan = complete.is_ok()
        && visited.len() == 10
        && visited.first() == Some(&dir.join("state.json"))
        && visited.get(7) == Some(&dir.join("recovery"))
        && visited.last() == Some(&dir.parent().unwrap().join("com.typet.app"));

    let mut attempted = Vec::new();
    let failed = reset_data_paths_with(&dir, true, |path| {
        attempted.push(path.to_path_buf());
        if path.file_name().and_then(|n| n.to_str()) == Some("photos") {
            Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "simulated reset denial",
            ))
        } else {
            Ok(())
        }
    });
    let failure_propagated =
        matches!(failed, Err(ref e) if e.contains("photos") && e.contains("denial"));
    let stopped_safely = attempted.last() == Some(&dir.join("photos"))
        && !attempted.contains(&dir.join("recovery"))
        && !attempted.contains(&dir.parent().unwrap().join("com.jellypal.app"));
    [exact_plan, failure_propagated, stopped_safely]
}

fn reset_cleanup_self_test() -> bool {
    let root = std::env::temp_dir().join(format!(
        "jellypal-reset-policy-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let outside = root.join("outside");
    let regular = root.join("regular");
    let root_seeded = std::fs::create_dir(&root).is_ok();
    let outside_seeded = std::fs::create_dir(&outside).is_ok()
        && std::fs::write(outside.join("keep.txt"), b"KEEP").is_ok();
    let regular_seeded = std::fs::create_dir(&regular).is_ok()
        && std::fs::write(regular.join("local.txt"), b"LOCAL").is_ok();
    let nested_link = regular.join("escape");
    let nested_link_created = create_migration_test_link(&nested_link, &outside);
    let root_link = root.join("linked-root");
    let root_link_created = create_migration_test_link(&root_link, &outside);
    let regular_removed = remove_tree_no_follow(&regular).is_ok() && !regular.exists();
    let root_link_removed = remove_tree_no_follow(&root_link).is_ok() && !root_link.exists();
    let outside_preserved =
        std::fs::read(outside.join("keep.txt")).ok().as_deref() == Some(b"KEEP");
    let file = root.join("unexpected-file");
    let file_removed = std::fs::write(&file, b"FILE").is_ok()
        && remove_tree_no_follow(&file).is_ok()
        && !file.exists();
    let absent_is_idempotent = remove_tree_no_follow(&root.join("absent")).is_ok();
    let checks = [
        root_seeded,
        outside_seeded,
        regular_seeded,
        nested_link_created,
        root_link_created,
        regular_removed,
        root_link_removed,
        outside_preserved,
        file_removed,
        absent_is_idempotent,
    ];
    let _ = remove_tree_no_follow(&root_link);
    let _ = std::fs::remove_dir_all(&root);
    checks.into_iter().all(|ok| ok)
}

#[tauri::command]
fn reset_save(app: tauri::AppHandle) -> Result<(), String> {
    // block any in-flight/queued save first — without this, a persist() that
    // was already on its way could land after the deletes and undo the reset
    RESETTING.store(true, Ordering::SeqCst);
    let _save_guard = lock_recover(&SAVE_IO_LOCK);
    // wipe every save artifact, then relaunch so the next boot is a true
    // first run. the .bak matters: load_state falls back to it, so leaving
    // it behind would resurrect the wiped save.
    let result = data_dir(&app).and_then(|dir| {
        // Kill legacy identifier dirs too: boot-time migration would copy an
        // old save back whenever the new directory has no state.json.
        reset_data_paths_with(&dir, test_data_dir().is_none(), remove_tree_no_follow)?;
        reg_clear()?;
        *lock_recover(&LAST_SAVE) = None;
        Ok(())
    });
    if let Err(error) = result {
        // Keep the current process usable and allow saves/retries after a
        // denied or otherwise incomplete cleanup instead of wedging RESETTING.
        RESETTING.store(false, Ordering::SeqCst);
        return Err(error);
    }
    tauri::process::restart(&app.env());
}

const CRASH_LOG_MAX_BYTES: u64 = 256 * 1024;
const CRASH_LOG_RETAIN_BYTES: usize = 192 * 1024;
const CRASH_MESSAGE_MAX_BYTES: usize = 4096;
const CRASH_MESSAGE_MAX_CHARS: usize = 8192;
const CRASH_MESSAGE_TRUNCATED: &str = " [message truncated]";
const CRASH_LOG_ROTATED: &[u8] = b"[older log entries dropped]\n";

// Produce exactly one bounded, printable record. In particular, CR/LF cannot
// forge extra log entries and a giant newline/control-character payload cannot
// make this error-reporting path spend unbounded time or memory formatting it.
fn format_crash_line(ms: u128, msg: &str) -> String {
    let mut body = String::with_capacity(CRASH_MESSAGE_MAX_BYTES);
    let mut chars = msg.chars().peekable();
    let mut scanned = 0usize;
    let mut in_newline = false;
    let mut truncated = false;

    while let Some(ch) = chars.next() {
        if scanned >= CRASH_MESSAGE_MAX_CHARS {
            truncated = true;
            break;
        }
        scanned += 1;

        let piece: &str;
        let mut utf8 = [0u8; 4];
        if ch == '\r' || ch == '\n' {
            if in_newline {
                continue;
            }
            in_newline = true;
            piece = " | ";
        } else if ch.is_control() {
            in_newline = false;
            piece = " ";
        } else {
            in_newline = false;
            piece = ch.encode_utf8(&mut utf8);
        }

        if body.len() + piece.len() > CRASH_MESSAGE_MAX_BYTES {
            truncated = true;
            break;
        }
        body.push_str(piece);
    }
    if chars.peek().is_some() {
        truncated = true;
    }
    if truncated {
        while body.len() + CRASH_MESSAGE_TRUNCATED.len() > CRASH_MESSAGE_MAX_BYTES {
            body.pop();
        }
        body.push_str(CRASH_MESSAGE_TRUNCATED);
    }
    format!("[{ms}] {body}\n")
}

fn crash_log_tail(path: &std::path::Path) -> std::io::Result<Vec<u8>> {
    use std::io::{Read, Seek, SeekFrom};
    let mut file = std::fs::File::open(path)?;
    let len = file.metadata()?.len();
    let start = len.saturating_sub(CRASH_LOG_RETAIN_BYTES as u64);
    file.seek(SeekFrom::Start(start))?;
    let mut tail = Vec::with_capacity((len - start) as usize);
    file.take(CRASH_LOG_RETAIN_BYTES as u64)
        .read_to_end(&mut tail)?;
    if start > 0 {
        // The seek may land halfway through a UTF-8 code point or record. Start
        // at the next complete line; all records written here end in LF.
        tail = tail
            .iter()
            .position(|&b| b == b'\n')
            .map(|i| tail[i + 1..].to_vec())
            .unwrap_or_default();
    }
    Ok(tail)
}

fn append_crash_log(path: &std::path::Path, msg: &str, ms: u128) -> std::io::Result<()> {
    let line = format_crash_line(ms, msg);
    let (exists, existing_len) = match std::fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_file() && !migration_reparse(&meta) => (true, meta.len()),
        Ok(_) => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "crash.log is not a regular file",
            ))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (false, 0),
        Err(e) => return Err(e),
    };

    let mut next = if existing_len.saturating_add(line.len() as u64) > CRASH_LOG_MAX_BYTES {
        let tail = crash_log_tail(path)?;
        let mut compact = Vec::with_capacity(CRASH_LOG_ROTATED.len() + tail.len());
        compact.extend_from_slice(CRASH_LOG_ROTATED);
        compact.extend_from_slice(&tail);
        compact
    } else if exists {
        read_regular_file(path, CRASH_LOG_MAX_BYTES)?
    } else {
        Vec::new()
    };
    next.extend_from_slice(line.as_bytes());
    write_atomic_regular(path, &next)
}

fn write_panic_log(path: &std::path::Path, msg: &str) -> std::io::Result<()> {
    let line = format_crash_line(0, msg);
    write_atomic_regular(path, line.as_bytes())
}

fn crash_log_policy_self_test() -> bool {
    let bounded = format_crash_line(7, &"🪼".repeat(5000));
    let newline_bomb = format_crash_line(8, &"\n".repeat(CRASH_MESSAGE_MAX_CHARS + 100));
    let base = std::env::temp_dir().join(format!(
        "jellypal-log-policy-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    if std::fs::create_dir(&base).is_err() {
        return false;
    }
    let log = base.join("crash.log");
    let normal_write =
        append_crash_log(&log, "FIRST", 10).is_ok() && append_crash_log(&log, "SECOND", 11).is_ok();
    let normal = std::fs::read_to_string(&log).unwrap_or_default();

    let mut oversized = String::new();
    while oversized.len() < CRASH_LOG_MAX_BYTES as usize + 4096 {
        oversized.push_str("old filler record\n");
    }
    oversized.push_str("LAST-RETAINED\n");
    let seeded = std::fs::write(&log, oversized).is_ok();
    let rotated_write = append_crash_log(&log, "NEW-DIAGNOSTIC", 12).is_ok();
    let rotated = std::fs::read_to_string(&log).unwrap_or_default();
    let rotated_len = std::fs::metadata(&log).map(|m| m.len()).unwrap_or(u64::MAX);

    let blocked = base.join("blocked");
    let dir_created = std::fs::create_dir(&blocked).is_ok();
    let rejects_non_file = append_crash_log(&blocked, "NOPE", 13).is_err();

    let outside = base.join("outside.txt");
    let linked = base.join("linked.log");
    let hardlink_seeded =
        std::fs::write(&outside, b"KEEP").is_ok() && std::fs::hard_link(&outside, &linked).is_ok();
    let hardlink_write = append_crash_log(&linked, "HARDLINK", 14).is_ok();
    let outside_preserved = std::fs::read(&outside).ok().as_deref() == Some(b"KEEP");
    let linked_first = std::fs::read_to_string(&linked).unwrap_or_default();

    let outside_tmp = base.join("outside-tmp.txt");
    let linked_tmp = base.join("linked.log.tmp");
    let temp_link_seeded = std::fs::write(&outside_tmp, b"TMP-KEEP").is_ok()
        && std::fs::hard_link(&outside_tmp, &linked_tmp).is_ok();
    let temp_link_write = append_crash_log(&linked, "SECOND", 15).is_ok();
    let outside_tmp_preserved = std::fs::read(&outside_tmp).ok().as_deref() == Some(b"TMP-KEEP");
    let linked_second = std::fs::read_to_string(&linked).unwrap_or_default();

    let panic_log = base.join("panic.log");
    let panic_normal_write = write_panic_log(&panic_log, "boom\r\nnext").is_ok();
    let panic_normal = std::fs::read_to_string(&panic_log).unwrap_or_default();
    let panic_bounded_write = write_panic_log(&panic_log, &"PANIC".repeat(2000)).is_ok();
    let panic_bounded = std::fs::read_to_string(&panic_log).unwrap_or_default();
    let panic_outside = base.join("panic-outside.txt");
    let panic_link_seeded = std::fs::remove_file(&panic_log).is_ok()
        && std::fs::write(&panic_outside, b"KEEP").is_ok()
        && std::fs::hard_link(&panic_outside, &panic_log).is_ok();
    let panic_link_write = write_panic_log(&panic_log, "LINKED").is_ok();
    let panic_link_isolated = std::fs::read(&panic_outside).ok().as_deref() == Some(b"KEEP")
        && std::fs::read_to_string(&panic_log)
            .map(|body| body == "[0] LINKED\n")
            .unwrap_or(false);
    let panic_outside_tmp = base.join("panic-outside-tmp.txt");
    let panic_tmp = base.join("panic.log.tmp");
    let panic_temp_link_seeded = std::fs::write(&panic_outside_tmp, b"TMP-KEEP").is_ok()
        && std::fs::hard_link(&panic_outside_tmp, &panic_tmp).is_ok();
    let panic_temp_link_write = write_panic_log(&panic_log, "SECOND").is_ok();
    let panic_temp_isolated = std::fs::read(&panic_outside_tmp).ok().as_deref()
        == Some(b"TMP-KEEP")
        && !panic_tmp.exists()
        && std::fs::read_to_string(&panic_log)
            .map(|body| body == "[0] SECOND\n")
            .unwrap_or(false);
    let _ = std::fs::remove_dir_all(&base);

    [
        format_crash_line(42, "boom") == "[42] boom\n",
        format_crash_line(42, "a\r\nb\nc\rd") == "[42] a | b | c | d\n",
        format_crash_line(42, "a\0b\u{1b}c\td") == "[42] a b c d\n",
        bounded.is_char_boundary(bounded.len()),
        bounded.contains(CRASH_MESSAGE_TRUNCATED),
        bounded.len() <= CRASH_MESSAGE_MAX_BYTES + 32,
        newline_bomb.contains(CRASH_MESSAGE_TRUNCATED),
        normal_write,
        normal == "[10] FIRST\n[11] SECOND\n",
        seeded,
        rotated_write,
        rotated.starts_with(std::str::from_utf8(CRASH_LOG_ROTATED).unwrap_or("")),
        rotated.contains("LAST-RETAINED\n"),
        rotated.ends_with("[12] NEW-DIAGNOSTIC\n"),
        rotated_len <= CRASH_LOG_MAX_BYTES,
        dir_created && rejects_non_file,
        hardlink_seeded,
        hardlink_write,
        outside_preserved,
        linked_first.contains("KEEP[14] HARDLINK\n"),
        temp_link_seeded,
        temp_link_write,
        outside_tmp_preserved,
        linked_second.contains("[14] HARDLINK\n") && linked_second.ends_with("[15] SECOND\n"),
        panic_normal_write,
        panic_normal == "[0] boom | next\n",
        panic_bounded_write
            && panic_bounded.contains(CRASH_MESSAGE_TRUNCATED)
            && panic_bounded.len() <= CRASH_MESSAGE_MAX_BYTES + 32,
        panic_link_seeded,
        panic_link_write,
        panic_link_isolated,
        panic_temp_link_seeded,
        panic_temp_link_write,
        panic_temp_isolated,
    ]
    .into_iter()
    .all(|ok| ok)
}

// Forensic log: frontend frame errors + a heartbeat so a frozen app can tell
// us afterwards whether JS was still alive and what threw.
#[tauri::command]
fn log_crash(app: tauri::AppHandle, msg: String) {
    let Ok(dir) = data_dir(&app) else {
        return;
    };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let _guard = lock_recover(&CRASH_LOG_LOCK);
    let _ = append_crash_log(&dir.join("crash.log"), &msg, ms);
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

fn prepare_regular_dir_path(path: &std::path::Path, create: bool) -> std::io::Result<()> {
    match std::fs::symlink_metadata(path) {
        Ok(meta) if meta.is_dir() && !migration_reparse(&meta) => Ok(()),
        Ok(_) => Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "path is not a regular directory",
        )),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound && create => {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::create_dir(path)?;
            let meta = std::fs::symlink_metadata(path)?;
            if meta.is_dir() && !migration_reparse(&meta) {
                Ok(())
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "created path is not a regular directory",
                ))
            }
        }
        Err(e) => Err(e),
    }
}

fn photos_dir(app: &tauri::AppHandle, create: bool) -> Result<std::path::PathBuf, String> {
    let dir = data_dir(app)?.join("photos");
    prepare_regular_dir_path(&dir, create).map_err(|e| e.to_string())?;
    Ok(dir)
}

const MAX_PHOTO_STEM: usize = 80;
const MAX_PNG_B64: usize = 64 * 1024 * 1024;
const MAX_PNG_BYTES: usize = MAX_PNG_B64 / 4 * 3;
const MAX_PNG_DIMENSION: u32 = 16_384;
const MAX_PNG_PIXELS: u64 = 64 * 1024 * 1024;
const MAX_PNG_CHUNKS: usize = 8_192;
// A photo folder is user-visible and can be modified outside the app. Keep a
// hostile or accidentally huge directory from turning one album-open IPC into
// an unbounded allocation or filesystem walk. Within the scan window retain
// the same lexicographically newest names the existing album UI opens first.
const MAX_PHOTO_SCAN_ENTRIES: usize = 16_384;
const MAX_PHOTO_CATALOG: usize = 4_096;
const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
fn valid_photo_stem(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_PHOTO_STEM
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn valid_photo_file_name(name: &str) -> bool {
    name.strip_suffix(".png").is_some_and(valid_photo_stem)
}

fn valid_photo_file_size(len: u64) -> bool {
    len >= 45 && len <= MAX_PNG_BYTES as u64
}

fn bounded_photo_catalog<I>(entries: I, scan_limit: usize, catalog_limit: usize) -> Vec<String>
where
    I: IntoIterator<Item = Option<String>>,
{
    if scan_limit == 0 || catalog_limit == 0 {
        return vec![];
    }
    let mut newest = std::collections::BinaryHeap::<std::cmp::Reverse<String>>::new();
    for name in entries.into_iter().take(scan_limit).flatten() {
        if newest.len() < catalog_limit {
            newest.push(std::cmp::Reverse(name));
        } else if newest.peek().is_some_and(|oldest| name > oldest.0) {
            newest.pop();
            newest.push(std::cmp::Reverse(name));
        }
    }
    let mut names: Vec<String> = newest.into_iter().map(|entry| entry.0).collect();
    names.sort();
    names
}

fn list_photo_names_in_dir(
    dir: &std::path::Path,
    scan_limit: usize,
    catalog_limit: usize,
) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return vec![];
    };
    bounded_photo_catalog(
        entries.map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_str()?.to_owned();
            let meta = std::fs::symlink_metadata(entry.path()).ok()?;
            (meta.file_type().is_file()
                && valid_photo_file_size(meta.len())
                && valid_photo_file_name(&name))
            .then_some(name)
        }),
        scan_limit,
        catalog_limit,
    )
}

fn png_u32(data: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes(data.get(at..at + 4)?.try_into().ok()?))
}

fn valid_png_ihdr(data: &[u8]) -> bool {
    if data.len() != 13 {
        return false;
    }
    let width = png_u32(data, 0).unwrap_or(0);
    let height = png_u32(data, 4).unwrap_or(0);
    let pixels = (width as u64).saturating_mul(height as u64);
    let bit_depth = data[8];
    let color_type = data[9];
    let depth_ok = match color_type {
        0 => matches!(bit_depth, 1 | 2 | 4 | 8 | 16),
        2 | 4 | 6 => matches!(bit_depth, 8 | 16),
        3 => matches!(bit_depth, 1 | 2 | 4 | 8),
        _ => false,
    };
    width > 0
        && height > 0
        && width <= MAX_PNG_DIMENSION
        && height <= MAX_PNG_DIMENSION
        && pixels <= MAX_PNG_PIXELS
        && depth_ok
        && data[10] == 0 // compression method
        && data[11] == 0 // filter method
        && data[12] <= 1 // interlace method
}

// Lightweight structural validation before a PNG reaches the browser image
// decoder. CRC/zlib decoding remains the browser's job; this gate contains
// dimensions, chunk walks, and malformed lengths so corrupt/bomb headers fail
// without allocating an image surface.
fn valid_png_structure(data: &[u8]) -> bool {
    if !valid_photo_file_size(data.len() as u64) || !data.starts_with(PNG_SIGNATURE) {
        return false;
    }
    let mut pos = PNG_SIGNATURE.len();
    let mut chunks = 0usize;
    let mut saw_ihdr = false;
    let mut saw_idat = false;
    let mut idat_ended = false;

    while pos < data.len() {
        chunks += 1;
        if chunks > MAX_PNG_CHUNKS || pos.checked_add(12).is_none_or(|end| end > data.len()) {
            return false;
        }
        let Some(length) = png_u32(data, pos).map(|n| n as usize) else {
            return false;
        };
        let kind = &data[pos + 4..pos + 8];
        if !kind.iter().all(|b| b.is_ascii_alphabetic()) {
            return false;
        }
        let Some(chunk_end) = pos
            .checked_add(8)
            .and_then(|start| start.checked_add(length))
            .and_then(|end| end.checked_add(4))
        else {
            return false;
        };
        if chunk_end > data.len() {
            return false;
        }
        let body = &data[pos + 8..pos + 8 + length];

        if chunks == 1 {
            if kind != b"IHDR" || !valid_png_ihdr(body) {
                return false;
            }
            saw_ihdr = true;
        } else if kind == b"IHDR" {
            return false;
        } else if kind == b"PLTE" {
            if saw_idat || body.is_empty() || body.len() > 768 || body.len() % 3 != 0 {
                return false;
            }
        } else if kind == b"IDAT" {
            if !saw_ihdr || idat_ended {
                return false;
            }
            if !body.is_empty() {
                saw_idat = true;
            }
        } else if kind == b"IEND" {
            return body.is_empty() && saw_ihdr && saw_idat && chunk_end == data.len();
        } else {
            // Uppercase first byte denotes a critical chunk. PNG defines only
            // IHDR/PLTE/IDAT/IEND; unknown critical data cannot be ignored.
            if kind[0].is_ascii_uppercase() {
                return false;
            }
            if saw_idat {
                idat_ended = true;
            }
        }
        pos = chunk_end;
    }
    false
}

fn decode_png_payload(data: &str) -> Result<Vec<u8>, String> {
    if data.is_empty() || data.len() > MAX_PNG_B64 || data.len() % 4 != 0 {
        return Err("invalid png payload size".into());
    }
    let pad = data.bytes().rev().take_while(|b| *b == b'=').count();
    if pad > 2
        || data.as_bytes()[..data.len() - pad].contains(&b'=')
        || !data
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/' || b == b'=')
    {
        return Err("invalid png base64".into());
    }
    let decoded = b64decode(data)?;
    if !valid_png_structure(&decoded) {
        return Err("invalid png structure".into());
    }
    Ok(decoded)
}

fn save_photo_file(path: &std::path::Path, data: &[u8]) -> std::io::Result<()> {
    match std::fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_file() && !migration_reparse(&meta) => {}
        Ok(_) => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "photo target is not a regular file",
            ));
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e),
    }
    write_atomic_regular(path, data)
}

fn read_photo_file(path: &std::path::Path) -> Result<Vec<u8>, String> {
    let data = read_regular_file(path, MAX_PNG_BYTES as u64).map_err(|e| e.to_string())?;
    if !valid_png_structure(&data) {
        return Err("invalid png structure".into());
    }
    Ok(data)
}

fn photo_policy_self_test() -> bool {
    let long = "x".repeat(MAX_PHOTO_STEM + 1);
    let valid_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    let valid = b64decode(valid_b64).unwrap_or_default();
    let mutate = |at: usize, bytes: &[u8]| {
        let mut png = valid.clone();
        png[at..at + bytes.len()].copy_from_slice(bytes);
        png
    };
    [
        valid_photo_stem("jellypal_123"),
        valid_photo_stem("share-ABC-9"),
        valid_photo_stem("A"),
        !valid_photo_stem(""),
        !valid_photo_stem("."),
        !valid_photo_stem(".."),
        !valid_photo_stem("../state"),
        !valid_photo_stem("a/b"),
        !valid_photo_stem(r"a\b"),
        !valid_photo_stem("a:b"),
        !valid_photo_stem("snowman-☃"),
        !valid_photo_stem(&long),
        valid_photo_file_name("jellypal_1.png"),
        valid_photo_file_name("share-A.png"),
        !valid_photo_file_name(".png"),
        !valid_photo_file_name("x.PNG"),
        !valid_photo_file_name("x..png"),
        !valid_photo_file_name("../x.png"),
        valid_png_structure(&valid),
        decode_png_payload(valid_b64).is_ok(),
        decode_png_payload("iVBORw0KGg!=").is_err(),
        decode_png_payload("dGV4dA==").is_err(),
        !valid_png_structure(PNG_SIGNATURE),
        !valid_png_structure(&mutate(16, &0u32.to_be_bytes())),
        !valid_png_structure(&mutate(16, &(MAX_PNG_DIMENSION + 1).to_be_bytes())),
        !valid_png_structure(&{
            let mut png = mutate(16, &8193u32.to_be_bytes());
            png[20..24].copy_from_slice(&8192u32.to_be_bytes());
            png
        }),
        valid_png_structure(&{
            let mut png = mutate(16, &8192u32.to_be_bytes());
            png[20..24].copy_from_slice(&8192u32.to_be_bytes());
            png
        }),
        !valid_png_structure(&mutate(25, &[1])),
        !valid_png_structure(&mutate(26, &[1])),
        !valid_png_structure(&mutate(27, &[1])),
        !valid_png_structure(&mutate(28, &[2])),
        !valid_png_structure(&mutate(8, &12u32.to_be_bytes())),
        !valid_png_structure(&mutate(37, b"tEXt")),
        !valid_png_structure(&valid[..56]),
        !valid_png_structure(&mutate(37, b"ABCD")),
        !valid_png_structure(&mutate(37, b"ID1T")),
        !valid_png_structure(&mutate(33, &u32::MAX.to_be_bytes())),
        !valid_png_structure(&{
            let mut png = valid.clone();
            png.push(0);
            png
        }),
    ]
    .into_iter()
    .all(|ok| ok)
}

const MAX_MIGRATION_DEPTH: usize = 8;
const MAX_MIGRATION_FILE_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Default)]
struct MigrationStats {
    files: usize,
    dirs: usize,
    skipped: usize,
}

fn migration_reparse(meta: &std::fs::Metadata) -> bool {
    if meta.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        // Junctions are mount-point reparse records rather than ordinary
        // symlinks, so FileType::is_symlink alone does not contain them.
        return meta.file_attributes() & 0x400 != 0;
    }
    #[cfg(not(windows))]
    false
}

fn prepare_migration_dir(path: &std::path::Path) -> std::io::Result<()> {
    match std::fs::symlink_metadata(path) {
        Ok(meta) if meta.is_dir() && !migration_reparse(&meta) => Ok(()),
        Ok(_) => Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "migration directory is not a regular directory",
        )),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            std::fs::create_dir(path)?;
            let meta = std::fs::symlink_metadata(path)?;
            if meta.is_dir() && !migration_reparse(&meta) {
                Ok(())
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "created migration directory is not regular",
                ))
            }
        }
        Err(e) => Err(e),
    }
}

fn copy_regular_file_atomic(
    src: &std::path::Path,
    dest: &std::path::Path,
    max_bytes: u64,
) -> std::io::Result<()> {
    use std::io::Read as _;

    let src_meta = std::fs::symlink_metadata(src)?;
    if !src_meta.file_type().is_file() || migration_reparse(&src_meta) || src_meta.len() > max_bytes
    {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "migration source is not a bounded regular file",
        ));
    }
    let name = dest.file_name().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "migration destination has no leaf",
        )
    })?;
    let mut tmp_name = name.to_os_string();
    tmp_name.push(".tmp");
    let tmp = dest.with_file_name(tmp_name);
    remove_file_leaf_no_follow(&tmp)?;

    let result = (|| {
        let input = std::fs::OpenOptions::new().read(true).open(src)?;
        let opened = input.metadata()?;
        if !opened.file_type().is_file() || migration_reparse(&opened) || opened.len() > max_bytes {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "opened migration source is outside policy",
            ));
        }
        let mut output = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)?;
        let copied = std::io::copy(&mut input.take(max_bytes.saturating_add(1)), &mut output)?;
        if copied > max_bytes {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "migration source grew beyond policy",
            ));
        }
        output.sync_all()?;
        drop(output);
        replace_regular_file(&tmp, dest)
    })();
    if result.is_err() {
        let _ = remove_file_leaf_no_follow(&tmp);
    }
    result
}

// Best-effort legacy-profile copy. Never follow links/junctions on either
// side, and bound nesting so a malformed old tree cannot wedge first boot.
// A bad entry is skipped while its safe siblings still migrate.
fn copy_legacy_tree(
    src: &std::path::Path,
    dst: &std::path::Path,
    depth: usize,
    stats: &mut MigrationStats,
) -> std::io::Result<()> {
    let src_meta = std::fs::symlink_metadata(src)?;
    if !src_meta.is_dir() || migration_reparse(&src_meta) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "migration source is not a regular directory",
        ));
    }
    prepare_migration_dir(dst)?;

    for entry in std::fs::read_dir(src)? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                stats.skipped += 1;
                continue;
            }
        };
        let source = entry.path();
        let dest = dst.join(entry.file_name());
        let meta = match std::fs::symlink_metadata(&source) {
            Ok(meta) => meta,
            Err(_) => {
                stats.skipped += 1;
                continue;
            }
        };
        if migration_reparse(&meta) {
            stats.skipped += 1;
            continue;
        }
        if meta.is_dir() {
            if depth >= MAX_MIGRATION_DEPTH {
                stats.skipped += 1;
                continue;
            }
            if copy_legacy_tree(&source, &dest, depth + 1, stats).is_ok() {
                stats.dirs += 1;
            } else {
                stats.skipped += 1;
            }
            continue;
        }
        if !meta.is_file() || meta.len() > MAX_MIGRATION_FILE_BYTES {
            stats.skipped += 1;
            continue;
        }
        match std::fs::symlink_metadata(&dest) {
            Ok(dest_meta) if !dest_meta.is_file() || migration_reparse(&dest_meta) => {
                stats.skipped += 1;
                continue;
            }
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => {
                stats.skipped += 1;
                continue;
            }
        }
        if copy_regular_file_atomic(&source, &dest, MAX_MIGRATION_FILE_BYTES).is_ok() {
            stats.files += 1;
        } else {
            stats.skipped += 1;
        }
    }
    Ok(())
}

#[cfg(windows)]
fn create_migration_test_link(link: &std::path::Path, target: &std::path::Path) -> bool {
    std::process::Command::new("cmd.exe")
        .args(["/D", "/C", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

fn photo_directory_self_test() -> bool {
    let root = std::env::temp_dir().join(format!(
        "jellypal-photo-directory-policy-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let root_seeded = std::fs::create_dir(&root).is_ok();
    let missing = root.join("missing");
    let missing_read_rejected = prepare_regular_dir_path(&missing, false).is_err();
    let missing_created = prepare_regular_dir_path(&missing, true).is_ok();
    let created_readable = prepare_regular_dir_path(&missing, false).is_ok();

    let file = root.join("file");
    let file_seeded = std::fs::write(&file, b"FILE").is_ok();
    let file_rejected = prepare_regular_dir_path(&file, false).is_err()
        && prepare_regular_dir_path(&file, true).is_err();

    let outside = root.join("outside");
    let outside_seeded = std::fs::create_dir(&outside).is_ok()
        && std::fs::write(outside.join("keep.txt"), b"KEEP").is_ok();
    let link = root.join("linked-photos");
    let link_created = create_migration_test_link(&link, &outside);
    let link_rejected = prepare_regular_dir_path(&link, false).is_err()
        && prepare_regular_dir_path(&link, true).is_err()
        && std::fs::read(outside.join("keep.txt")).ok().as_deref() == Some(b"KEEP");

    let checks = [
        root_seeded,
        missing_read_rejected,
        missing_created,
        created_readable,
        file_seeded,
        file_rejected,
        outside_seeded && link_created,
        link_rejected,
    ];
    let _ = std::fs::remove_dir(&link);
    let _ = std::fs::remove_dir_all(&root);
    checks.into_iter().all(|ok| ok)
}

fn data_directory_self_test() -> bool {
    let root = std::env::temp_dir().join(format!(
        "jellypal-data-directory-policy-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let root_seeded = std::fs::create_dir(&root).is_ok();
    let regular = root.join("regular");
    let regular_created = ensure_data_dir(regular.clone()).ok().as_deref() == Some(&regular);
    let regular_accepted = ensure_data_dir(regular.clone()).is_ok();

    let file = root.join("file");
    let file_seeded = std::fs::write(&file, b"FILE").is_ok();
    let file_rejected = ensure_data_dir(file).is_err();

    let outside = root.join("outside");
    let outside_seeded = std::fs::create_dir(&outside).is_ok()
        && std::fs::write(outside.join("keep.txt"), b"KEEP").is_ok();
    let linked = root.join("linked-data");
    let link_created = create_migration_test_link(&linked, &outside);
    let link_rejected = ensure_data_dir(linked.clone()).is_err();
    let outside_preserved =
        std::fs::read(outside.join("keep.txt")).ok().as_deref() == Some(b"KEEP");
    let checks = [
        root_seeded,
        regular_created,
        regular_accepted,
        file_seeded,
        file_rejected,
        outside_seeded,
        link_created,
        link_rejected,
        outside_preserved,
    ];
    let _ = std::fs::remove_dir(&linked);
    let _ = std::fs::remove_dir_all(&root);
    checks.into_iter().all(|ok| ok)
}

fn photo_catalog_self_test() -> bool {
    let root = std::env::temp_dir().join(format!(
        "jellypal-photo-catalog-policy-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let root_seeded = std::fs::create_dir(&root).is_ok();
    let payload = [7u8; 45];
    let entries_seeded = std::fs::write(root.join("jellypal_001.png"), payload).is_ok()
        && std::fs::write(root.join("jellypal_002.png"), payload).is_ok()
        && std::fs::write(root.join("jellypal_004.png"), payload).is_ok()
        && std::fs::write(root.join("tiny.png"), [0u8; 44]).is_ok()
        && std::fs::write(root.join("wrong.PNG"), payload).is_ok()
        && std::fs::create_dir(root.join("jellypal_003.png")).is_ok();
    let full = list_photo_names_in_dir(&root, usize::MAX, usize::MAX);
    let capped = list_photo_names_in_dir(&root, usize::MAX, 2);
    let retained = bounded_photo_catalog(
        ["001", "005", "003", "004", "002"]
            .into_iter()
            .map(|name| Some(name.to_owned())),
        usize::MAX,
        3,
    );
    let invalid_consumes_scan =
        bounded_photo_catalog([Some("001".to_owned()), None, Some("999".to_owned())], 2, 3);
    let production_bound = bounded_photo_catalog(
        (0..MAX_PHOTO_SCAN_ENTRIES + 10).map(|n| Some(format!("{n:05}"))),
        MAX_PHOTO_SCAN_ENTRIES,
        MAX_PHOTO_CATALOG,
    );
    let checks = [
        root_seeded,
        entries_seeded,
        full == ["jellypal_001.png", "jellypal_002.png", "jellypal_004.png"],
        capped == ["jellypal_002.png", "jellypal_004.png"],
        retained == ["003", "004", "005"],
        invalid_consumes_scan == ["001"],
        production_bound.len() == MAX_PHOTO_CATALOG
            && production_bound.first().map(String::as_str) == Some("12288")
            && production_bound.last().map(String::as_str) == Some("16383"),
        bounded_photo_catalog([Some("x".to_owned())], 0, 1).is_empty(),
        bounded_photo_catalog([Some("x".to_owned())], 1, 0).is_empty(),
    ];
    let _ = std::fs::remove_dir_all(&root);
    checks.into_iter().all(|ok| ok)
}

fn photo_write_self_test() -> bool {
    let root = std::env::temp_dir().join(format!(
        "jellypal-photo-write-policy-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let photos = root.join("photos");
    let outside = root.join("outside");
    let root_seeded =
        std::fs::create_dir_all(&photos).is_ok() && std::fs::create_dir(&outside).is_ok();
    let valid = b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    )
    .unwrap_or_default();
    let payload_valid = valid_png_structure(&valid);

    let fresh = photos.join("fresh.png");
    let fresh_written = save_photo_file(&fresh, &valid).is_ok()
        && std::fs::read(&fresh).ok().as_deref() == Some(valid.as_slice());
    let fresh_read = read_photo_file(&fresh).ok().as_deref() == Some(valid.as_slice());
    let blocked_temp_target = photos.join("blocked-temp.png");
    let blocked_temp = photos.join("blocked-temp.png.tmp");
    let temp_directory_seeded = std::fs::create_dir(&blocked_temp).is_ok()
        && std::fs::write(blocked_temp.join("keep.txt"), b"KEEP").is_ok();
    let temp_directory_rejected = save_photo_file(&blocked_temp_target, &valid).is_err()
        && std::fs::read(blocked_temp.join("keep.txt")).ok().as_deref() == Some(b"KEEP")
        && !blocked_temp_target.exists();
    let tiny = photos.join("tiny.png");
    let tiny_rejected = std::fs::write(&tiny, [0u8; 44]).is_ok() && read_photo_file(&tiny).is_err();
    let invalid = photos.join("invalid.png");
    let invalid_rejected =
        std::fs::write(&invalid, [0u8; 45]).is_ok() && read_photo_file(&invalid).is_err();
    let oversized = photos.join("oversized.png");
    let oversized_rejected = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&oversized)
        .and_then(|file| file.set_len(MAX_PNG_BYTES as u64 + 1))
        .is_ok()
        && read_photo_file(&oversized).is_err();

    let outside_target = outside.join("target.txt");
    let linked = photos.join("linked.png");
    let target_link_seeded = std::fs::write(&outside_target, b"KEEP").is_ok()
        && std::fs::hard_link(&outside_target, &linked).is_ok();
    let target_link_written = save_photo_file(&linked, &valid).is_ok();
    let target_isolated = std::fs::read(&outside_target).ok().as_deref() == Some(b"KEEP")
        && std::fs::read(&linked).ok().as_deref() == Some(valid.as_slice());

    let outside_tmp = outside.join("temp.txt");
    let linked_tmp = photos.join("linked.png.tmp");
    let temp_link_seeded = std::fs::write(&outside_tmp, b"TMP-KEEP").is_ok()
        && std::fs::hard_link(&outside_tmp, &linked_tmp).is_ok();
    let temp_link_written = save_photo_file(&linked, &valid).is_ok();
    let temp_isolated =
        std::fs::read(&outside_tmp).ok().as_deref() == Some(b"TMP-KEEP") && !linked_tmp.exists();

    let blocked = photos.join("blocked.png");
    let directory_rejected =
        std::fs::create_dir(&blocked).is_ok() && save_photo_file(&blocked, &valid).is_err();
    let checks = [
        root_seeded,
        payload_valid,
        fresh_written,
        fresh_read,
        temp_directory_seeded,
        temp_directory_rejected,
        tiny_rejected,
        invalid_rejected,
        oversized_rejected,
        target_link_seeded,
        target_link_written,
        target_isolated,
        temp_link_seeded,
        temp_link_written,
        temp_isolated,
        directory_rejected,
    ];
    let _ = std::fs::remove_dir_all(&root);
    checks.into_iter().all(|ok| ok)
}

#[cfg(unix)]
fn create_migration_test_link(link: &std::path::Path, target: &std::path::Path) -> bool {
    std::os::unix::fs::symlink(target, link).is_ok()
}

fn migration_policy_self_test() -> bool {
    let root = std::env::temp_dir().join(format!(
        "jellypal-migration-policy-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let src = root.join("src");
    let dst = root.join("dst");
    let outside = root.join("outside");
    if std::fs::create_dir_all(src.join("photos")).is_err()
        || std::fs::create_dir_all(&dst).is_err()
        || std::fs::create_dir_all(&outside).is_err()
    {
        return false;
    }
    let seeded = std::fs::write(src.join("state.json"), b"STATE").is_ok()
        && std::fs::write(src.join("photos").join("safe.png"), b"PNG").is_ok()
        && std::fs::write(src.join("collision"), b"SOURCE").is_ok()
        && std::fs::create_dir(dst.join("collision")).is_ok()
        && std::fs::write(dst.join("collision").join("keep.txt"), b"KEEP").is_ok()
        && std::fs::write(outside.join("secret.txt"), b"SECRET").is_ok();

    let linked_source = src.join("linked-dest.txt");
    let linked_dest = dst.join("linked-dest.txt");
    let outside_dest = outside.join("dest.txt");
    let hardlink_seeded = std::fs::write(&linked_source, b"MIGRATED").is_ok()
        && std::fs::write(&outside_dest, b"KEEP").is_ok()
        && std::fs::hard_link(&outside_dest, &linked_dest).is_ok();
    let linked_tmp = dst.join("linked-dest.txt.tmp");
    let outside_tmp = outside.join("temp.txt");
    let temp_hardlink_seeded = std::fs::write(&outside_tmp, b"TMP-KEEP").is_ok()
        && std::fs::hard_link(&outside_tmp, &linked_tmp).is_ok();
    let oversized = src.join("oversized.bin");
    let oversized_seeded = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&oversized)
        .and_then(|file| file.set_len(MAX_MIGRATION_FILE_BYTES + 1))
        .is_ok();
    let temp_dir_source = src.join("temp-dir-dest.txt");
    let temp_dir = dst.join("temp-dir-dest.txt.tmp");
    let temp_dir_seeded = std::fs::write(&temp_dir_source, b"LOCAL").is_ok()
        && std::fs::create_dir(&temp_dir).is_ok()
        && std::fs::write(temp_dir.join("keep.txt"), b"KEEP").is_ok();

    let mut deep = src.join("deep");
    let _ = std::fs::create_dir(&deep);
    for i in 0..=MAX_MIGRATION_DEPTH {
        deep = deep.join(format!("d{i}"));
        let _ = std::fs::create_dir(&deep);
    }
    let deep_seeded = std::fs::write(deep.join("too-deep.txt"), b"DEEP").is_ok();
    let link = src.join("escape");
    let link_created = create_migration_test_link(&link, &outside);

    let mut stats = MigrationStats::default();
    let copied = copy_legacy_tree(&src, &dst, 0, &mut stats).is_ok();
    let mut other = MigrationStats::default();
    let link_root_rejected =
        copy_legacy_tree(&link, &root.join("link-copy"), 0, &mut other).is_err();
    let bad_dst = root.join("bad-dst");
    let bad_dst_seeded = std::fs::write(&bad_dst, b"FILE").is_ok();
    let bad_dst_rejected = copy_legacy_tree(&src, &bad_dst, 0, &mut other).is_err();

    let checks = [
        seeded,
        hardlink_seeded,
        temp_hardlink_seeded,
        oversized_seeded,
        temp_dir_seeded,
        deep_seeded,
        link_created,
        copied,
        std::fs::read(dst.join("state.json")).ok().as_deref() == Some(b"STATE"),
        std::fs::read(dst.join("photos").join("safe.png"))
            .ok()
            .as_deref()
            == Some(b"PNG"),
        !dst.join("escape").exists(),
        !dst.join("deep")
            .join("d0")
            .join("d1")
            .join("d2")
            .join("d3")
            .join("d4")
            .join("d5")
            .join("d6")
            .join("d7")
            .join("d8")
            .join("too-deep.txt")
            .exists(),
        std::fs::read(dst.join("collision").join("keep.txt"))
            .ok()
            .as_deref()
            == Some(b"KEEP"),
        std::fs::read(&linked_dest).ok().as_deref() == Some(b"MIGRATED"),
        std::fs::read(&outside_dest).ok().as_deref() == Some(b"KEEP"),
        std::fs::read(&outside_tmp).ok().as_deref() == Some(b"TMP-KEEP"),
        !linked_tmp.exists(),
        !dst.join("oversized.bin").exists(),
        std::fs::read(temp_dir.join("keep.txt")).ok().as_deref() == Some(b"KEEP"),
        !dst.join("temp-dir-dest.txt").exists(),
        stats.files == 3,
        stats.skipped >= 5,
        link_root_rejected,
        bad_dst_seeded && bad_dst_rejected,
    ];
    let _ = std::fs::remove_dir(&link);
    let _ = std::fs::remove_dir_all(&root);
    checks.into_iter().all(|ok| ok)
}

#[tauri::command]
fn list_photos(app: tauri::AppHandle) -> Vec<String> {
    let Ok(dir) = photos_dir(&app, false) else {
        return vec![];
    };
    list_photo_names_in_dir(&dir, MAX_PHOTO_SCAN_ENTRIES, MAX_PHOTO_CATALOG)
}

// minimal base64 encoder for returning photo bytes to the frontend
fn b64encode(data: &[u8]) -> String {
    const TBL: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len() * 4 / 3 + 4);
    for c in data.chunks(3) {
        let n = ((c[0] as u32) << 16)
            | ((*c.get(1).unwrap_or(&0) as u32) << 8)
            | (*c.get(2).unwrap_or(&0) as u32);
        out.push(TBL[(n >> 18) as usize & 63] as char);
        out.push(TBL[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 {
            TBL[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if c.len() > 2 {
            TBL[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

#[tauri::command]
fn load_photo(app: tauri::AppHandle, name: String) -> Result<String, String> {
    let dir = photos_dir(&app, false)?;
    if !valid_photo_file_name(&name) {
        return Err("invalid photo name".into());
    }
    let path = dir.join(&name);
    let data = read_photo_file(&path)?;
    Ok(b64encode(&data))
}

#[tauri::command]
fn delete_photo(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let dir = photos_dir(&app, false)?;
    if !valid_photo_file_name(&name) {
        return Err("invalid photo name".into());
    }
    let path = dir.join(&name);
    if !std::fs::symlink_metadata(&path)
        .map(|m| m.file_type().is_file())
        .unwrap_or(false)
    {
        return Err("photo is not a regular file".into());
    }
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_photos(app: tauri::AppHandle) -> Result<(), String> {
    let dir = photos_dir(&app, true)?;
    open_with_shell(&dir.to_string_lossy())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    // gem-shop store link — only ever https, opened in the default browser
    if !valid_https_url(&url) {
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
    if s.len() > 128 {
        return None;
    }
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
    if !valid_redeem_input(code.trim()) {
        return Err("bad code".into());
    }
    let up = code.trim().to_uppercase();
    let body = up.strip_prefix("JELLYPAL-").unwrap_or(up.as_str());
    let mut it = body.split('-');
    let pack = it.next().ok_or("bad code")?;
    let nonce = it.next().ok_or("bad code")?;
    let sigs = it.next().ok_or("bad code")?;
    if it.next().is_some() || !valid_nonce(nonce) || !valid_b32_text(sigs, 103) {
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
    vk.verify(msg.as_bytes(), &sig)
        .map_err(|_| "bad code".to_string())?;
    Ok(gems)
}

#[tauri::command]
fn verify_gem_code(code: String) -> Result<u64, String> {
    verify_code_with(&GEM_PUBKEY, &code)
}

// ---- server-bound grants ----
// the shop backend is a tiny Cloudflare worker + KV. the app owns a
// per-install uid (shown under MY ID in settings); the server stores only
// sha256(uid), and grants are signed by a dedicated SERVER keypair — a
// compromised worker still can't mint codes (that's the seller key's job,
// and it never leaves the seller's disk).
const SERVER_PUBKEY: [u8; 32] = [
    0xC9, 0xA7, 0xC5, 0x34, 0x05, 0x17, 0x41, 0x78, 0x42, 0x4A, 0x18, 0x66, 0x8C, 0xC0, 0xC1, 0x63,
    0xDB, 0xA3, 0x8D, 0xE7, 0xA4, 0xB6, 0x93, 0x8B, 0x04, 0xBF, 0x44, 0xBB, 0x05, 0x45, 0xEC, 0x91,
];
// the deployed worker's URL — every server call degrades gracefully to the
// offline path if this is unreachable
const SERVER_URL: &str = "https://api.jellypal.fun";
const MAX_UID_BYTES: usize = 26;
const MAX_REDEEM_CODE_BYTES: usize = 160;
const MAX_ACK_INPUT_NONCES: usize = 256;
const MAX_ACK_NONCES: usize = 64;
const MAX_GRANTS_PER_RESPONSE: usize = 64;
const MAX_SERVER_RESPONSE_BYTES: usize = 256 * 1024;
const MAX_WEATHER_RESPONSE_BYTES: usize = 64 * 1024;
const MAX_VERSION_RESPONSE_BYTES: usize = 64;
const MAX_HTTPS_URL_BYTES: usize = 2_048;

fn valid_b32_text(value: &str, exact_len: usize) -> bool {
    value.len() == exact_len
        && value
            .bytes()
            .all(|b| b.is_ascii_uppercase() || matches!(b, b'2'..=b'7'))
}

fn valid_uid(uid: &str) -> bool {
    uid.len() == MAX_UID_BYTES
        && uid.starts_with("JP")
        && valid_b32_text(&uid[2..], MAX_UID_BYTES - 2)
}

fn valid_redeem_input(code: &str) -> bool {
    !code.is_empty()
        && code.len() <= MAX_REDEEM_CODE_BYTES
        && code.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

fn valid_nonce(nonce: &str) -> bool {
    valid_b32_text(nonce, 8)
}

fn valid_https_url(url: &str) -> bool {
    if url.is_empty()
        || url.len() > MAX_HTTPS_URL_BYTES
        || url.contains('\\')
        || !url.bytes().all(|byte| byte.is_ascii_graphic())
    {
        return false;
    }
    let Ok(parsed) = tauri::Url::parse(url) else {
        return false;
    };
    parsed.scheme() == "https"
        && parsed.host_str().is_some_and(|host| !host.is_empty())
        && parsed.username().is_empty()
        && parsed.password().is_none()
}

fn valid_release_version(value: &str) -> bool {
    let mut parts = value.split('.');
    for _ in 0..3 {
        let Some(part) = parts.next() else {
            return false;
        };
        if part.is_empty()
            || (part.len() > 1 && part.starts_with('0'))
            || !part.bytes().all(|byte| byte.is_ascii_digit())
            || part.parse::<u32>().is_err()
        {
            return false;
        }
    }
    parts.next().is_none()
}

fn sanitize_ack_nonces(nonces: Vec<String>) -> Vec<String> {
    let mut clean = Vec::with_capacity(MAX_ACK_NONCES);
    for nonce in nonces.into_iter().take(MAX_ACK_INPUT_NONCES) {
        if valid_nonce(&nonce) && !clean.contains(&nonce) {
            clean.push(nonce);
            if clean.len() == MAX_ACK_NONCES {
                break;
            }
        }
    }
    clean
}

// Read at most one byte beyond the policy, then refuse an oversized
// producer before it can make a broken/malicious endpoint consume
// arbitrary memory. Shared by child-stdout reads and HTTP response bodies.
fn read_capped(reader: impl std::io::Read, max_bytes: usize) -> std::io::Result<Vec<u8>> {
    use std::io::Read as _;
    let mut bytes = Vec::with_capacity(max_bytes.min(8 * 1024));
    reader
        .take(max_bytes.saturating_add(1) as u64)
        .read_to_end(&mut bytes)?;
    if bytes.len() > max_bytes {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "response exceeds policy",
        ));
    }
    Ok(bytes)
}

// `Command::output` buffers child stdout without a ceiling — pipe through
// the cap and terminate an oversized producer instead.
fn bounded_command_output(
    command: &mut std::process::Command,
    max_bytes: usize,
) -> std::io::Result<Vec<u8>> {
    use std::process::Stdio;

    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let Some(stdout) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return Err(std::io::Error::new(
            std::io::ErrorKind::BrokenPipe,
            "child stdout unavailable",
        ));
    };
    let bytes = match read_capped(stdout, max_bytes) {
        Ok(b) => b,
        Err(e) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(e);
        }
    };
    let status = child.wait()?;
    if !status.success() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            "child command failed",
        ));
    }
    Ok(bytes)
}

fn run_checked_command(command: &mut std::process::Command) -> std::io::Result<()> {
    use std::process::Stdio;

    let status = command
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("child command exited with {status}"),
        ))
    }
}

// In-process HTTP client — a curl subprocess cannot run inside the App
// Sandbox. One shared agent: an 8s global timeout bounds every call
// (the old per-request --max-time values were 5–8s). http_status_as_error
// is off so an HTTP error page still reaches parse_server_json as a body,
// matching the old curl -s contract where only transport failure meant
// "offline".
fn http_agent() -> &'static ureq::Agent {
    use std::sync::OnceLock;
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| {
        ureq::Agent::new_with_config(
            ureq::config::Config::builder()
                .timeout_global(Some(std::time::Duration::from_secs(8)))
                .http_status_as_error(false)
                .build(),
        )
    })
}

fn http_post(url: &str, body: &str) -> Option<String> {
    let mut resp = http_agent()
        .post(url)
        .header("Content-Type", "application/json")
        .send(body)
        .ok()?;
    String::from_utf8(read_capped(resp.body_mut().as_reader(), MAX_SERVER_RESPONSE_BYTES).ok()?)
        .ok()
}

fn http_get(url: &str, max_bytes: usize) -> Option<String> {
    let mut resp = http_agent().get(url).call().ok()?;
    String::from_utf8(read_capped(resp.body_mut().as_reader(), max_bytes).ok()?).ok()
}

// A transport-level success is not the same as an application-level success:
// an HTTP error response is still a response, and the worker reports those as
// JSON `{error: ...}` bodies. Keep every grant endpoint on the same strict
// contract so a refusal or malformed response is never mistaken for success.
fn parse_server_json(response: &str) -> Result<serde_json::Value, String> {
    let value: serde_json::Value =
        serde_json::from_str(response).map_err(|_| "bad response".to_string())?;
    if let Some(error) = value.get("error").and_then(|entry| entry.as_str()) {
        return Err(error.to_string());
    }
    Ok(value)
}

fn parse_ack_response(response: &str) -> Result<(), String> {
    let value = parse_server_json(response)?;
    if value.get("ok").and_then(|entry| entry.as_bool()) == Some(true) {
        Ok(())
    } else {
        Err("bad response".into())
    }
}

fn network_policy_self_test() -> bool {
    const TEST_UID: &str = "JPABCDEFGHIJKLMNOPQRSTUVWX";
    const B32: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let mixed = sanitize_ack_nonces(vec![
        "ABCDEFGH".into(),
        "BAD".into(),
        "ABCDEFGH".into(),
        "234567AB".into(),
    ]);
    let flood: Vec<String> = (0..MAX_ACK_NONCES + 10)
        .map(|n| {
            format!(
                "AAAAAA{}{}",
                B32[(n / 32) % 32] as char,
                B32[n % 32] as char
            )
        })
        .collect();
    let bounded_flood = sanitize_ack_nonces(flood);
    let mut invalid_first = vec!["BAD".to_string(); MAX_ACK_INPUT_NONCES];
    invalid_first.push("ABCDEFGH".into());
    let capped_ok = read_capped(&b"OK"[..], 64).ok();
    let capped_over = read_capped(&vec![b'X'; 65][..], 64).is_err();

    let small_output = std::env::current_exe().ok().and_then(|exe| {
        let mut command = std::process::Command::new(exe);
        command.arg("--network-policy-child-small");
        bounded_command_output(&mut command, MAX_VERSION_RESPONSE_BYTES).ok()
    });
    let large_rejected = std::env::current_exe().ok().is_some_and(|exe| {
        let mut command = std::process::Command::new(exe);
        command.arg("--network-policy-child-large");
        bounded_command_output(&mut command, MAX_VERSION_RESPONSE_BYTES).is_err()
    });
    let checked_success = std::env::current_exe().ok().is_some_and(|exe| {
        let mut command = std::process::Command::new(exe);
        command.arg("--network-policy-child-small");
        run_checked_command(&mut command).is_ok()
    });
    let checked_failure = std::env::current_exe().ok().is_some_and(|exe| {
        let mut command = std::process::Command::new(exe);
        command.arg("--network-policy-child-fail");
        run_checked_command(&mut command).is_err()
    });
    [
        valid_uid(TEST_UID),
        !valid_uid("JPabcdefghijklmnopqrstuvwx"),
        !valid_uid("XXABCDEFGHIJKLMNOPQRSTUVWX"),
        !valid_uid("JPABC"),
        valid_redeem_input("abc-123-XYZ"),
        !valid_redeem_input(""),
        !valid_redeem_input(&"A".repeat(MAX_REDEEM_CODE_BYTES + 1)),
        !valid_redeem_input("ABC 123"),
        valid_nonce("ABCDEFGH"),
        !valid_nonce("AAAAAAA1"),
        valid_b32_text(&"A".repeat(103), 103),
        !valid_b32_text(&"A".repeat(102), 103),
        valid_https_url("https://example.com/a?b=1"),
        !valid_https_url("http://example.com"),
        !valid_https_url("https://example.com/\nnext"),
        !valid_https_url(&format!("https://{}", "x".repeat(MAX_HTTPS_URL_BYTES))),
        valid_https_url("https://example.com:8443/store?q=1#buy"),
        !valid_https_url("https://?q=1"),
        !valid_https_url("https://user@example.com/store"),
        !valid_https_url("https://user:pass@example.com/store"),
        !valid_https_url("https://example.com\\@evil.test/store"),
        !valid_https_url("https://example.com:70000/store"),
        valid_release_version("0.2.16"),
        valid_release_version("4294967295.0.1"),
        !valid_release_version("1.2"),
        !valid_release_version("1.2.3.4"),
        !valid_release_version("01.2.3"),
        !valid_release_version("1.a.3"),
        !valid_release_version("4294967296.0.0"),
        !valid_release_version("1..3"),
        mixed == ["ABCDEFGH", "234567AB"],
        bounded_flood.len() == MAX_ACK_NONCES
            && bounded_flood.first().map(String::as_str) == Some("AAAAAAAA")
            && bounded_flood.last().map(String::as_str) == Some("AAAAAAB7"),
        sanitize_ack_nonces(invalid_first).is_empty(),
        capped_ok.as_deref() == Some(b"OK"),
        capped_over,
        small_output.as_deref() == Some(b"OK"),
        large_rejected,
        checked_success,
        checked_failure,
        parse_ack_response(r#"{"ok":true}"#).is_ok(),
        parse_ack_response(r#"{"ok":false}"#).is_err(),
        matches!(
            parse_ack_response(r#"{"error":"server busy"}"#),
            Err(error) if error == "server busy"
        ),
        matches!(
            parse_ack_response("not json"),
            Err(error) if error == "bad response"
        ),
    ]
    .into_iter()
    .all(|ok| ok)
}

// grant wire shape: {pack, nonce, tag, sig} where sig is base32(ed25519
// signature of "JP2G:{pack}:{nonce}:{tag}") under SERVER_PUBKEY. the tag is
// uid[2..10] — binds the grant to one install so a leaked grant is junk.
fn verify_grant(v: &serde_json::Value, uid: &str) -> Result<(String, u64), String> {
    use ed25519_dalek::Verifier as _;
    if !valid_uid(uid) {
        return Err("bad uid".into());
    }
    let pack = v.get("pack").and_then(|x| x.as_str()).ok_or("bad grant")?;
    let nonce = v.get("nonce").and_then(|x| x.as_str()).ok_or("bad grant")?;
    let tag = v.get("tag").and_then(|x| x.as_str()).ok_or("bad grant")?;
    let sigs = v.get("sig").and_then(|x| x.as_str()).ok_or("bad grant")?;
    if !valid_nonce(nonce)
        || !valid_b32_text(tag, 8)
        || !valid_b32_text(sigs, 103)
        || tag != &uid[2..10]
    {
        return Err("grant is bound to a different user".into());
    }
    let sig_bytes = b32dec(sigs).ok_or("bad grant")?;
    if sig_bytes.len() != 64 {
        return Err("bad grant".into());
    }
    let sig = ed25519_dalek::Signature::from_slice(&sig_bytes).map_err(|e| e.to_string())?;
    let vk = ed25519_dalek::VerifyingKey::from_bytes(&SERVER_PUBKEY).map_err(|e| e.to_string())?;
    let msg = format!("JP2G:{pack}:{nonce}:{tag}");
    vk.verify(msg.as_bytes(), &sig)
        .map_err(|_| "bad grant".to_string())?;
    let gems = GEM_AMOUNTS
        .iter()
        .find(|(p, _)| *p == pack)
        .ok_or("bad grant")?
        .1;
    Ok((nonce.to_string(), gems))
}

// redeem a purchased code: the worker verifies the seller signature, binds
// the code to this uid so it can't be shared, and returns a signed grant.
// Err("offline") means the server never answered — the caller may fall back
// to offline verification; any other Err is a real refusal (e.g. a code
// already claimed by a different uid) and must NOT fall back.
// async so the http agent's up-to-8s block lands on a runtime worker, not the event
// loop — a sync command here froze set_clickable/set_dragging dispatch and
// made the overlay briefly eat clicks on a slow/flaky network
#[tauri::command]
async fn redeem_bound(uid: String, code: String) -> Result<u64, String> {
    if SERVER_URL.is_empty() {
        return Err("offline".into());
    }
    if !valid_uid(&uid) || !valid_redeem_input(&code) {
        return Err("bad request".into());
    }
    let body = serde_json::json!({ "uid": uid, "code": code }).to_string();
    let resp = http_post(&format!("{SERVER_URL}/redeem"), &body).ok_or("offline")?;
    let v = parse_server_json(&resp)?;
    let g = v.get("grant").cloned().ok_or("bad response")?;
    verify_grant(&g, &uid).map(|(_, gems)| gems)
}

// pending shop grants for this uid -> JSON array [{nonce, gems}] for the
// frontend to credit then ack (ack loss is safe: grants resend, and the
// client dedupes by nonce)
#[tauri::command]
async fn claim_grants(uid: String) -> Result<String, String> {
    if SERVER_URL.is_empty() {
        return Ok("[]".into());
    }
    if !valid_uid(&uid) {
        return Err("bad request".into());
    }
    let body = serde_json::json!({ "uid": uid }).to_string();
    let resp = http_post(&format!("{SERVER_URL}/claim"), &body).ok_or("offline")?;
    let v = parse_server_json(&resp)?;
    let mut out = Vec::new();
    let grants = v
        .get("grants")
        .and_then(|entry| entry.as_array())
        .ok_or("bad response")?;
    for grant in grants.iter().take(MAX_GRANTS_PER_RESPONSE) {
        if let Ok((nonce, gems)) = verify_grant(grant, &uid) {
            out.push(serde_json::json!({ "nonce": nonce, "gems": gems }));
        }
    }
    serde_json::to_string(&out).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ack_grants(uid: String, nonces: Vec<String>) -> Result<(), String> {
    if SERVER_URL.is_empty() {
        return Ok(());
    }
    if !valid_uid(&uid) {
        return Err("bad request".into());
    }
    let nonces = sanitize_ack_nonces(nonces);
    if nonces.is_empty() {
        return Ok(());
    }
    let body = serde_json::json!({ "uid": uid, "nonces": nonces }).to_string();
    let response = http_post(&format!("{SERVER_URL}/ack"), &body).ok_or("offline")?;
    parse_ack_response(&response)
}

#[tauri::command]
async fn check_update(url: String) -> Result<String, String> {
    // version probe — fetches a tiny text file (e.g. "0.2.1") hosted next to
    // the itch page
    if !valid_https_url(&url) {
        return Err("refusing non-https url".into());
    }
    let body = http_get(&url, MAX_VERSION_RESPONSE_BYTES)
        .ok_or("fetch failed")?
        .trim()
        .to_string();
    if body.is_empty() || body.len() > 32 || !valid_release_version(&body) {
        return Err("bad version payload".into());
    }
    Ok(body)
}

#[tauri::command]
async fn get_weather() -> Option<i64> {
    // local weather for cosmetic reactions (umbrella, snowflakes).
    // ipapi.co gives coarse lat/lon over https; open-meteo needs no key.
    let geo = http_get("https://ipapi.co/json/", MAX_WEATHER_RESPONSE_BYTES)?;
    let g: serde_json::Value = serde_json::from_str(&geo).ok()?;
    let lat = g.get("latitude")?.as_f64()?;
    let lon = g.get("longitude")?.as_f64()?;
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current_weather=true",
        lat, lon
    );
    let met = http_get(&url, MAX_WEATHER_RESPONSE_BYTES)?;
    let m: serde_json::Value = serde_json::from_str(&met).ok()?;
    m.pointer("/current_weather/weathercode")?.as_i64()
}

// True when built with `--features store` — the frontend reads this once
// to switch into the sandboxed companion-card UI (no redeem, no overlay
// toggles) and to hide controls that cannot work under the App Sandbox.
#[tauri::command]
fn is_store_build() -> bool {
    cfg!(feature = "store")
}

// the settings BOOT row only makes sense where autostart can actually
// work: Windows Run key, direct-mac LaunchAgent, or store-mac on 13+
// (SMAppService exists). Below that the row stays hidden entirely.
#[tauri::command]
fn autostart_available() -> bool {
    #[cfg(windows)]
    {
        return true;
    }
    #[cfg(all(target_os = "macos", not(feature = "store")))]
    {
        return true;
    }
    #[cfg(all(target_os = "macos", feature = "store"))]
    {
        return smapp::available();
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        return false;
    }
}

#[tauri::command]
fn set_autostart(enable: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        // HKCU Run key — the slime is meant to live on the desktop, so it
        // belongs in startup when the user asks for it
        return set_windows_autostart(enable);
    }
    #[cfg(all(target_os = "macos", feature = "store"))]
    {
        // A sandboxed app cannot drop LaunchAgents into ~/Library — the
        // store path is SMAppService login items (macOS 13+; the row stays
        // hidden below that, see autostart_available).
        return smapp::set_enabled(enable);
    }
    #[cfg(all(target_os = "macos", not(feature = "store")))]
    {
        // per-user LaunchAgent — the macOS equivalent of the Run key
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        let dir = std::path::PathBuf::from(home).join("Library/LaunchAgents");
        let plist = dir.join("com.jellypal.desktop.plist");
        if enable {
            prepare_regular_dir_path(&dir, true).map_err(|e| e.to_string())?;
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe = exe
                .to_str()
                .ok_or_else(|| "autostart path is not valid UTF-8".to_string())?;
            let body = launch_agent_plist(exe)?;
            write_atomic_regular(&plist, body.as_bytes()).map_err(|e| e.to_string())?;
        } else {
            remove_file_leaf_no_follow(&plist).map_err(|e| e.to_string())?;
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
    let dir = photos_dir(&app, true)?;
    if !valid_photo_stem(&name) {
        return Err("invalid photo name".into());
    }
    let path = dir.join(format!("{name}.png"));
    let decoded = decode_png_payload(&data)?;
    save_photo_file(&path, &decoded).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(windows)]
unsafe extern "system" fn enum_windows_cb(hwnd: HWND, lparam: LPARAM) -> i32 {
    let rects = &mut *(lparam as *mut Vec<[i32; 4]>);
    if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
        return TRUE;
    }
    let mut r = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
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

// mouse-button state for the click-through toggle — a synchronous state
// query, not a global event tap, so it needs no Input Monitoring or
// accessibility permission on either platform. (The old rdev listener
// was the only tap; it is gone — typing rewards were removed.)
#[cfg(windows)]
fn any_mouse_button_held() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    // VK_LBUTTON / VK_RBUTTON / VK_MBUTTON — high bit set while held
    unsafe {
        GetAsyncKeyState(0x01) < 0 || GetAsyncKeyState(0x02) < 0 || GetAsyncKeyState(0x04) < 0
    }
}
#[cfg(target_os = "macos")]
fn any_mouse_button_held() -> bool {
    // CGEventSourceButtonState(kCGEventSourceStateCombinedSessionState, btn)
    // reads the live button bitmask — no event tap, no permission
    extern "C" {
        fn CGEventSourceButtonState(state_id: i32, button: u32) -> bool;
    }
    unsafe {
        CGEventSourceButtonState(0, 0)
            || CGEventSourceButtonState(0, 1)
            || CGEventSourceButtonState(0, 2)
    }
}
#[cfg(not(any(windows, target_os = "macos")))]
fn any_mouse_button_held() -> bool {
    false
}

// macOS auto-hiding Dock: NSScreen.visibleFrame (our work_area source)
// only excludes a VISIBLE dock — with auto-hide on, the "usable" floor
// still sits inside the strip the Dock slides over, so slimes on the
// bottom floor get covered every time the Dock pops. Read com.apple.dock
// once at startup and inset the matching edge by the tile size.
// Returns (orientation, reserve_px) — reserve 0 when dock stays hidden
// or the lookup fails. CFPreferencesCopyAppValue is the public,
// sandbox-safe API for this — no `defaults` subprocess.
#[cfg(target_os = "macos")]
mod dock_prefs {
    use std::ffi::{c_char, c_void, CString};

    pub enum Pref {
        Bool(bool),
        Num(f64),
        Str(String),
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFStringCreateWithCString(
            alloc: *const c_void,
            s: *const c_char,
            encoding: u32,
        ) -> *const c_void;
        fn CFPreferencesCopyAppValue(
            key: *const c_void,
            app_id: *const c_void,
        ) -> *const c_void;
        fn CFRelease(cf: *const c_void);
        fn CFGetTypeID(cf: *const c_void) -> usize;
        fn CFBooleanGetTypeID() -> usize;
        fn CFBooleanGetValue(b: *const c_void) -> bool;
        fn CFNumberGetTypeID() -> usize;
        fn CFNumberGetValue(n: *const c_void, ty: i64, out: *mut f64) -> bool;
        fn CFStringGetTypeID() -> usize;
        fn CFStringGetLength(s: *const c_void) -> isize;
        fn CFStringGetMaximumSizeForEncoding(len: isize, enc: u32) -> isize;
        fn CFStringGetCString(s: *const c_void, buf: *mut c_char, size: isize, enc: u32)
            -> bool;
    }

    const UTF8: u32 = 0x0800_0100; // kCFStringEncodingUTF8
    const K_DOUBLE: i64 = 13; // kCFNumberDoubleType

    fn cfstr(s: &str) -> *const c_void {
        let c = CString::new(s).expect("preference key has no NUL");
        unsafe { CFStringCreateWithCString(std::ptr::null(), c.as_ptr(), UTF8) }
    }

    // Reads one key from com.apple.dock. Value class is checked before
    // coercion so a user-edited plist with an unexpected type falls back
    // to our defaults instead of misparsing.
    pub fn value(key: &str) -> Option<Pref> {
        unsafe {
            let k = cfstr(key);
            let app = cfstr("com.apple.dock");
            let v = CFPreferencesCopyAppValue(k, app);
            CFRelease(k);
            CFRelease(app);
            if v.is_null() {
                return None;
            }
            let tid = CFGetTypeID(v);
            let out = if tid == CFBooleanGetTypeID() {
                Some(Pref::Bool(CFBooleanGetValue(v)))
            } else if tid == CFNumberGetTypeID() {
                let mut n = 0.0f64;
                CFNumberGetValue(v, K_DOUBLE, &mut n).then_some(Pref::Num(n))
            } else if tid == CFStringGetTypeID() {
                let len = CFStringGetMaximumSizeForEncoding(CFStringGetLength(v), UTF8) + 1;
                let mut buf = vec![0u8; len as usize];
                CFStringGetCString(v, buf.as_mut_ptr() as *mut c_char, len, UTF8)
                    .then(|| String::from_utf8_lossy(&buf).trim_matches('\0').to_string())
                    .map(Pref::Str)
            } else {
                None
            };
            CFRelease(v);
            out
        }
    }
}

#[cfg(target_os = "macos")]
fn dock_reserve() -> (String, f64) {
    use dock_prefs::{value as pref, Pref};
    if !matches!(pref("autohide"), Some(Pref::Bool(true))) {
        return (String::new(), 0.0);
    }
    let orient = match pref("orientation") {
        Some(Pref::Str(s)) => s.to_lowercase(),
        _ => "bottom".into(),
    };
    let tiles = match pref("tilesize") {
        Some(Pref::Num(n)) => n,
        _ => 48.0,
    }
    .clamp(24.0, 128.0);
    // magnification can swell hovered tiles well past tilesize — keep a
    // little air so the slime's feet never sit inside the pop zone
    (orient, tiles + 14.0)
}

#[cfg(not(target_os = "macos"))]
fn dock_reserve() -> (String, f64) {
    (String::new(), 0.0)
}

// SMAppService.mainAppService (macOS 13+) is the sandbox-safe login item:
// the store build registers the app itself — no LaunchAgent plist, no
// helper bundle. The class lookup doubles as the availability gate:
// SMAppService simply does not exist before macOS 13.
#[cfg(all(target_os = "macos", feature = "store"))]
mod smapp {
    use std::ffi::{c_char, c_void};

    // linking the framework is what registers the class with the runtime
    #[link(name = "ServiceManagement", kind = "framework")]
    extern "C" {}

    #[link(name = "objc", kind = "dylib")]
    extern "C" {
        fn objc_getClass(name: *const c_char) -> *const c_void;
        fn sel_registerName(name: *const c_char) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send0(obj: *const c_void, sel: *const c_void) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_err(
            obj: *const c_void,
            sel: *const c_void,
            err: *mut *const c_void,
        ) -> bool;
        #[link_name = "objc_msgSend"]
        fn send_int(obj: *const c_void, sel: *const c_void) -> i64;
    }

    pub fn available() -> bool {
        unsafe { !objc_getClass(b"SMAppService\0".as_ptr() as *const c_char).is_null() }
    }

    fn service() -> Option<*const c_void> {
        unsafe {
            let cls = objc_getClass(b"SMAppService\0".as_ptr() as *const c_char);
            if cls.is_null() {
                return None;
            }
            let svc = send0(
                cls,
                sel_registerName(b"mainAppService\0".as_ptr() as *const c_char),
            );
            (!svc.is_null()).then_some(svc)
        }
    }

    // SMAppServiceStatus: 0 notRegistered, 1 enabled, 2 requiresApproval
    fn status(svc: *const c_void) -> i64 {
        unsafe { send_int(svc, sel_registerName(b"status\0".as_ptr() as *const c_char)) }
    }

    pub fn set_enabled(enable: bool) -> Result<(), String> {
        let svc = service().ok_or_else(|| "login items need macOS 13+".to_string())?;
        let name: &[u8] = if enable {
            b"registerAndReturnError:\0"
        } else {
            b"unregisterAndReturnError:\0"
        };
        unsafe {
            let mut err: *const c_void = std::ptr::null();
            let ok = send_err(
                svc,
                sel_registerName(name.as_ptr() as *const c_char),
                &mut err,
            );
            // "already in that state" counts as success — the goal is the
            // end state, not the transition. status 1 = enabled.
            let want: i64 = if enable { 1 } else { 0 };
            if ok || status(svc) == want {
                Ok(())
            } else {
                Err("login item request refused".into())
            }
        }
    }
}

// ---- App Store IAP (StoreKit 1) ----
// The only sanctioned way to sell digital goods inside the store SKU. Raw
// objc FFI like everything else here: two runtime-built classes — a
// SKPaymentTransactionObserver and a SKProductsRequestDelegate — feed one
// event queue the frontend drains while the pack panel is open. Packs are
// consumable; a "purchased" transaction grants jelly and is finished.
// Server-side receipt validation is the upgrade path (cheap digital goods
// make local fulfillment an acceptable v1), see NEXT.md.
#[cfg(all(target_os = "macos", feature = "store"))]
mod iap {
    use std::ffi::{c_char, c_void, CString};
    use std::sync::Mutex;

    // product ids must match the App Store Connect records; jelly amounts
    // are the grant the frontend applies on a completed purchase. They
    // mirror the direct-build GEM_PACKS tiers so value stays consistent
    // across channels.
    pub const PACKS: [(&str, i64); 4] = [
        ("com.jellypal.jelly.small", 250),
        ("com.jellypal.jelly.medium", 500),
        ("com.jellypal.jelly.large", 1000),
        ("com.jellypal.jelly.xl", 2500),
    ];

    // purchasable product (price string is localized by the store itself)
    struct Prod {
        id: String,
        title: String,
        price: String,
        raw: *const c_void, // retained SKProduct — needed to build a payment
    }
    unsafe impl Send for Prod {}

    // EVENTS: one-shot notifications (restored/failed) the frontend drains.
    // PENDING: purchased transactions awaiting a grant ack — they are NOT
    // finished until iap_ack runs, so a crash between delivery and grant
    // makes StoreKit redeliver them on the next launch. Pointers are
    // retained; unfinished transactions live in the queue either way.
    static EVENTS: Mutex<Vec<serde_json::Value>> = Mutex::new(Vec::new());
    static PENDING: Mutex<Vec<(usize, String)>> = Mutex::new(Vec::new());
    static PRODUCTS: Mutex<Vec<Prod>> = Mutex::new(Vec::new());
    static LIVE_REQS: Mutex<Vec<usize>> = Mutex::new(Vec::new());
    static OBSERVER: Mutex<usize> = Mutex::new(0);
    static DELEGATE: Mutex<usize> = Mutex::new(0);

    // linking the framework is what registers SK* classes with the runtime
    // — without it objc_getClass returns null and IAP silently dies
    #[link(name = "StoreKit", kind = "framework")]
    extern "C" {}
    #[link(name = "objc", kind = "dylib")]
    extern "C" {
        fn objc_getClass(name: *const c_char) -> *const c_void;
        fn sel_registerName(name: *const c_char) -> *const c_void;
        fn objc_allocateClassPair(
            sup: *const c_void,
            name: *const c_char,
            extra: usize,
        ) -> *const c_void;
        fn class_addMethod(
            cls: *const c_void,
            sel: *const c_void,
            imp: *const c_void,
            types: *const c_char,
        ) -> bool;
        fn objc_registerClassPair(cls: *const c_void);
        #[link_name = "objc_msgSend"]
        fn send0(obj: *const c_void, sel: *const c_void) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_obj(obj: *const c_void, sel: *const c_void, a: *const c_void) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_objs(
            obj: *const c_void,
            sel: *const c_void,
            a: *const c_void,
            b: *const c_void,
        ) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_cstr(obj: *const c_void, sel: *const c_void, a: *const c_char) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_usize(obj: *const c_void, sel: *const c_void) -> usize;
        #[link_name = "objc_msgSend"]
        fn send_idx(obj: *const c_void, sel: *const c_void, a: usize) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_isize(obj: *const c_void, sel: *const c_void) -> isize;
        #[link_name = "objc_msgSend"]
        fn send_cstr_ret(obj: *const c_void, sel: *const c_void) -> *const c_char;
    }

    unsafe fn cls(n: &[u8]) -> *const c_void {
        objc_getClass(n.as_ptr() as *const c_char)
    }
    unsafe fn sel(n: &[u8]) -> *const c_void {
        sel_registerName(n.as_ptr() as *const c_char)
    }
    unsafe fn ns_str(s: &str) -> *const c_void {
        let c = CString::new(s).unwrap_or_default();
        send_cstr(cls(b"NSString\0"), sel(b"stringWithUTF8String:\0"), c.as_ptr())
    }
    unsafe fn rs_str(ns: *const c_void) -> String {
        if ns.is_null() {
            return String::new();
        }
        let p = send_cstr_ret(ns, sel(b"UTF8String\0"));
        if p.is_null() {
            return String::new();
        }
        std::ffi::CStr::from_ptr(p).to_string_lossy().into_owned()
    }
    unsafe fn retain(o: *const c_void) -> *const c_void {
        send0(o, sel(b"retain\0"))
    }
    unsafe fn release(o: *const c_void) {
        send0(o, sel(b"release\0"));
    }
    fn jelly_for(pid: &str) -> i64 {
        PACKS.iter().find(|(id, _)| id == &pid).map(|(_, j)| *j).unwrap_or(0)
    }
    fn push(ev: serde_json::Value) {
        crate::lock_recover(&EVENTS).push(ev);
    }

    // paymentQueue:updatedTransactions: — the only required observer method
    extern "C" fn on_updated(
        _s: *const c_void,
        _c: *const c_void,
        queue: *const c_void,
        txs: *const c_void,
    ) {
        unsafe {
            let n = send_usize(txs, sel(b"count\0"));
            for i in 0..n {
                let tx = send_idx(txs, sel(b"objectAtIndex:\0"), i);
                if tx.is_null() {
                    continue;
                }
                let state = send_isize(tx, sel(b"transactionState\0"));
                let pay = send0(tx, sel(b"payment\0"));
                let pid = rs_str(send0(pay, sel(b"productIdentifier\0")));
                match state {
                    1 => {
                        // purchased: retain the tx and park it in PENDING —
                        // drain surfaces it, iap_ack finishes it. No event
                        // push here; drain synthesizes one per pending tx.
                        let mut pend = crate::lock_recover(&PENDING);
                        if !pend.iter().any(|(t, _)| *t == tx as usize) {
                            retain(tx);
                            pend.push((tx as usize, pid));
                        }
                    }
                    3 => {
                        // restored: consumables are not restorable, so this
                        // is informational only — no grant, finish now.
                        push(serde_json::json!({ "kind": "restored", "product": pid }));
                        send_obj(queue, sel(b"finishTransaction:\0"), tx);
                    }
                    2 => {
                        let err = send0(tx, sel(b"error\0"));
                        let code = if err.is_null() { -1 } else { send_isize(err, sel(b"code\0")) };
                        // SKErrorPaymentCancelled = 2: user tap-out, quiet UI
                        push(serde_json::json!({
                            "kind": "failed", "product": pid, "code": code,
                        }));
                        send_obj(queue, sel(b"finishTransaction:\0"), tx);
                    }
                    _ => {} // 0 purchasing, 4 deferred — just wait
                }
            }
        }
    }

    // productsRequest:didReceiveResponse: — cache product objects (retained)
    // so buy() can build real SKPayment instances, not the deprecated
    // identifier-only path. Releases the finished request.
    extern "C" fn on_products(
        _s: *const c_void,
        _c: *const c_void,
        req: *const c_void,
        resp: *const c_void,
    ) {
        unsafe {
            let arr = send0(resp, sel(b"products\0"));
            let n = if arr.is_null() { 0 } else { send_usize(arr, sel(b"count\0")) };
            let mut fresh = Vec::new();
            for i in 0..n {
                let p = send_idx(arr, sel(b"objectAtIndex:\0"), i);
                if p.is_null() {
                    continue;
                }
                let id = rs_str(send0(p, sel(b"productIdentifier\0")));
                let title = rs_str(send0(p, sel(b"localizedTitle\0")));
                // localized price: NSNumberFormatter currency + product locale
                let price_obj = send0(p, sel(b"price\0"));
                let loc = send0(p, sel(b"priceLocale\0"));
                let fmt = send0(send0(cls(b"NSNumberFormatter\0"), sel(b"alloc\0")), sel(b"init\0"));
                send_idx(fmt, sel(b"setNumberStyle:\0"), 2); // NSNumberFormatterCurrencyStyle
                send_obj(fmt, sel(b"setLocale:\0"), loc);
                let price = rs_str(send_obj(fmt, sel(b"stringFromNumber:\0"), price_obj));
                release(fmt);
                fresh.push(Prod { id, title, price, raw: retain(p) });
            }
            *crate::lock_recover(&PRODUCTS) = fresh;
            // drop the request from the live set and release our +1
            let mut live = crate::lock_recover(&LIVE_REQS);
            if let Some(pos) = live.iter().position(|&r| r == req as usize) {
                live.remove(pos);
            }
            drop(live);
            release(req);
        }
    }

    // request:didFailWithError: — the request is dead either way; drop our
    // retain and tell the frontend so the shop does not look frozen
    extern "C" fn on_req_failed(
        _s: *const c_void,
        _c: *const c_void,
        req: *const c_void,
        _err: *const c_void,
    ) {
        let mut live = crate::lock_recover(&LIVE_REQS);
        if let Some(pos) = live.iter().position(|&r| r == req as usize) {
            live.remove(pos);
        }
        drop(live);
        push(serde_json::json!({ "kind": "catalog_failed" }));
        unsafe { release(req); }
    }

    // build a one-method class implementing the given selector; NSObject
    // parent so alloc/init exist
    unsafe fn make_class(name: &[u8], sel_name: &[u8], imp: *const c_void) -> *const c_void {
        let sup = cls(b"NSObject\0");
        let c = objc_allocateClassPair(sup, name.as_ptr() as *const c_char, 0);
        if c.is_null() {
            return c;
        }
        class_addMethod(
            c,
            sel(sel_name),
            imp,
            b"v@:@@\0".as_ptr() as *const c_char,
        );
        objc_registerClassPair(c);
        c
    }

    fn ensure_runtime() {
        let mut obs = crate::lock_recover(&OBSERVER);
        if *obs != 0 {
            return;
        }
        unsafe {
            let ocls = make_class(
                b"JPStoreObserver\0",
                b"paymentQueue:updatedTransactions:\0",
                on_updated as *const c_void,
            );
            let dcls = make_class(
                b"JPIapDelegate\0",
                b"productsRequest:didReceiveResponse:\0",
                on_products as *const c_void,
            );
            if !dcls.is_null() {
                class_addMethod(
                    dcls,
                    sel(b"request:didFailWithError:\0"),
                    on_req_failed as *const c_void,
                    b"v@:@@\0".as_ptr() as *const c_char,
                );
            }
            if ocls.is_null() || dcls.is_null() {
                return;
            }
            let observer = send0(send0(ocls, sel(b"alloc\0")), sel(b"init\0"));
            let delegate = send0(send0(dcls, sel(b"alloc\0")), sel(b"init\0"));
            let queue = send0(cls(b"SKPaymentQueue\0"), sel(b"defaultQueue\0"));
            send_obj(queue, sel(b"addTransactionObserver:\0"), observer);
            *obs = observer as usize;
            *crate::lock_recover(&DELEGATE) = delegate as usize;
        }
    }

    pub fn ready() -> bool {
        unsafe {
            let q = cls(b"SKPaymentQueue\0");
            if q.is_null() {
                return false;
            }
            #[link(name = "objc", kind = "dylib")]
            extern "C" {
                #[link_name = "objc_msgSend"]
                fn send_bool0(obj: *const c_void, sel: *const c_void) -> bool;
            }
            send_bool0(q, sel(b"canMakePayments\0"))
        }
    }

    pub fn refresh() -> Result<(), String> {
        if !ready() {
            return Err("purchases are disabled on this device".into());
        }
        ensure_runtime();
        unsafe {
            // NSString** array of ids -> NSArray -> NSSet
            let mut ids: Vec<*const c_void> = PACKS.iter().map(|(id, _)| ns_str(id)).collect();
            let arr = send_objs(
                cls(b"NSArray\0"),
                sel(b"arrayWithObjects:count:\0"),
                ids.as_mut_ptr() as *const c_void,
                ids.len() as *const c_void,
            );
            let set = send_obj(cls(b"NSSet\0"), sel(b"setWithArray:\0"), arr);
            let req = send_obj(
                send0(cls(b"SKProductsRequest\0"), sel(b"alloc\0")),
                sel(b"initWithProductIdentifiers:\0"),
                set,
            );
            if req.is_null() {
                return Err("products request could not start".into());
            }
            let delegate = *crate::lock_recover(&DELEGATE) as *const c_void;
            send_obj(req, sel(b"setDelegate:\0"), delegate);
            crate::lock_recover(&LIVE_REQS).push(req as usize);
            send0(req, sel(b"start\0"));
        }
        Ok(())
    }

    pub fn buy(product_id: &str) -> Result<(), String> {
        if !ready() {
            return Err("purchases are disabled on this device".into());
        }
        ensure_runtime();
        let prods = crate::lock_recover(&PRODUCTS);
        let raw = prods
            .iter()
            .find(|p| p.id == product_id)
            .map(|p| p.raw)
            .ok_or_else(|| "product not loaded yet — refresh the shop".to_string())?;
        unsafe {
            let pay = send_obj(
                cls(b"SKPayment\0"),
                sel(b"paymentWithProduct:\0"),
                raw,
            );
            let queue = send0(cls(b"SKPaymentQueue\0"), sel(b"defaultQueue\0"));
            send_obj(queue, sel(b"addPayment:\0"), pay);
        }
        Ok(())
    }

    pub fn products_json() -> serde_json::Value {
        let prods = crate::lock_recover(&PRODUCTS);
        let list: Vec<serde_json::Value> = prods
            .iter()
            .map(|p| {
                serde_json::json!({
                    "id": p.id, "title": p.title, "price": p.price, "jelly": jelly_for(&p.id),
                })
            })
            .collect();
        serde_json::json!(list)
    }

    // drain surfaces every unfinished purchase once per call — the frontend
    // dedupes by tx id and acks after crediting jelly. Re-surfacing on each
    // drain means a lost ack is retried by the next poll instead of lost.
    pub fn drain_json() -> serde_json::Value {
        let mut out: Vec<serde_json::Value> = crate::lock_recover(&PENDING)
            .iter()
            .map(|(tx, pid)| serde_json::json!({
                "kind": "purchased", "product": pid,
                "jelly": jelly_for(pid), "tx": format!("{}", tx),
            }))
            .collect();
        let evs: Vec<serde_json::Value> = crate::lock_recover(&EVENTS).drain(..).collect();
        out.extend(evs);
        serde_json::json!(out)
    }

    // grant acknowledged by the frontend — finish the transaction and
    // release our hold on it
    pub fn ack(tx_str: &str) {
        let Ok(ptr) = tx_str.parse::<usize>() else { return };
        let mut pend = crate::lock_recover(&PENDING);
        let Some(pos) = pend.iter().position(|(t, _)| *t == ptr) else { return };
        let (tx, _) = pend.remove(pos);
        drop(pend);
        unsafe {
            let queue = send0(cls(b"SKPaymentQueue\0"), sel(b"defaultQueue\0"));
            send_obj(queue, sel(b"finishTransaction:\0"), tx as *const c_void);
            release(tx as *const c_void);
        }
    }
}

#[cfg(all(target_os = "macos", feature = "store"))]
#[tauri::command]
fn iap_ready() -> bool {
    iap::ready()
}

#[cfg(all(target_os = "macos", feature = "store"))]
#[tauri::command]
fn iap_refresh() -> Result<(), String> {
    iap::refresh()
}

#[cfg(all(target_os = "macos", feature = "store"))]
#[tauri::command]
fn iap_buy(product_id: String) -> Result<(), String> {
    iap::buy(&product_id)
}

#[cfg(all(target_os = "macos", feature = "store"))]
#[tauri::command]
fn iap_products() -> serde_json::Value {
    iap::products_json()
}

#[cfg(all(target_os = "macos", feature = "store"))]
#[tauri::command]
fn iap_drain() -> serde_json::Value {
    iap::drain_json()
}

#[cfg(all(target_os = "macos", feature = "store"))]
#[tauri::command]
fn iap_ack(tx: String) {
    iap::ack(&tx)
}

// stubs keep the frontend's invoke surface identical across flavors — the
// direct build answers "not a store build" instead of command-not-found
#[cfg(not(all(target_os = "macos", feature = "store")))]
#[tauri::command]
fn iap_ready() -> bool {
    false
}
#[cfg(not(all(target_os = "macos", feature = "store")))]
#[tauri::command]
fn iap_refresh() -> Result<(), String> {
    Err("iap unavailable in this build".into())
}
#[cfg(not(all(target_os = "macos", feature = "store")))]
#[tauri::command]
fn iap_buy(_product_id: String) -> Result<(), String> {
    Err("iap unavailable in this build".into())
}
#[cfg(not(all(target_os = "macos", feature = "store")))]
#[tauri::command]
fn iap_products() -> serde_json::Value {
    serde_json::json!([])
}
#[cfg(not(all(target_os = "macos", feature = "store")))]
#[tauri::command]
fn iap_drain() -> serde_json::Value {
    serde_json::json!([])
}
#[cfg(not(all(target_os = "macos", feature = "store")))]
#[tauri::command]
fn iap_ack(_tx: String) {}



// NSWorkspace.openURL is the sandbox-sanctioned way to hand a URL or
// folder to the OS — spawning `/usr/bin/open` is not allowed in the App
// Sandbox. Raw objc calls keep this dependency-free.
#[cfg(target_os = "macos")]
fn ns_open(target: &str) -> Result<(), String> {
    use std::ffi::{c_char, c_void, CString};

    #[link(name = "objc", kind = "dylib")]
    extern "C" {
        fn objc_getClass(name: *const c_char) -> *const c_void;
        fn sel_registerName(name: *const c_char) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send0(obj: *const c_void, sel: *const c_void) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_obj(obj: *const c_void, sel: *const c_void, a: *const c_void) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_cstr(obj: *const c_void, sel: *const c_void, a: *const c_char) -> *const c_void;
        #[link_name = "objc_msgSend"]
        fn send_bool(obj: *const c_void, sel: *const c_void, a: *const c_void) -> bool;
    }
    unsafe {
        let cls = |n: &[u8]| objc_getClass(n.as_ptr() as *const c_char);
        let sel = |n: &[u8]| sel_registerName(n.as_ptr() as *const c_char);
        let c = CString::new(target).map_err(|_| "bad target".to_string())?;
        let ns_str = send_cstr(
            cls(b"NSString\0"),
            sel(b"stringWithUTF8String:\0"),
            c.as_ptr(),
        );
        if ns_str.is_null() {
            return Err("string alloc failed".into());
        }
        let url_sel = if target.starts_with("http") {
            sel(b"URLWithString:\0")
        } else {
            sel(b"fileURLWithPath:\0")
        };
        let url = send_obj(cls(b"NSURL\0"), url_sel, ns_str);
        if url.is_null() {
            return Err("url alloc failed".into());
        }
        let ws = send0(cls(b"NSWorkspace\0"), sel(b"sharedWorkspace\0"));
        if ws.is_null() {
            return Err("workspace unavailable".into());
        }
        if send_bool(ws, sel(b"openURL:\0"), url) {
            Ok(())
        } else {
            Err("openURL refused".into())
        }
    }
}

// open a folder or url with the OS default handler
fn open_with_shell(target: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return ns_open(target);
    }
    #[cfg(not(target_os = "macos"))]
    {
        #[cfg(windows)]
        let cmd = "explorer";
        #[cfg(all(unix, not(target_os = "macos")))]
        let cmd = "xdg-open";
        std::process::Command::new(cmd)
            .arg(target)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // seller diagnostic: `jellypal.exe --verify-code JELLYPAL-...` checks a
    // minted code against the embedded pubkey and exits — handy to confirm
    // a Stripe/Gumroad code really works before listing it
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--network-policy-child-small") {
        use std::io::Write as _;
        let _ = std::io::stdout().write_all(b"OK");
        std::process::exit(0);
    }
    if args.iter().any(|a| a == "--network-policy-child-large") {
        use std::io::Write as _;
        let _ = std::io::stdout().write_all(&vec![b'X'; MAX_VERSION_RESPONSE_BYTES + 1]);
        std::process::exit(0);
    }
    if args.iter().any(|a| a == "--network-policy-child-fail") {
        std::process::exit(7);
    }
    if args.iter().any(|a| a == "--self-test-network-policy") {
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
        if network_policy_self_test() {
            println!("NETWORK POLICY GREEN (43/43)");
            std::process::exit(0);
        }
        println!("NETWORK POLICY FAILED");
        std::process::exit(2);
    }
    if args.iter().any(|a| a == "--self-test-input-policy") {
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
        if clickable_policy_self_test() {
            println!("INPUT POLICY GREEN (23/23)");
            std::process::exit(0);
        }
        println!("INPUT POLICY FAILED");
        std::process::exit(2);
    }
    if args.iter().any(|a| a == "--self-test-save-policy") {
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
        if save_policy_self_test()
            && recovery_self_test()
            && save_filesystem_self_test()
            && save_payload_self_test()
            && reset_cleanup_self_test()
            && reset_plan_self_test().into_iter().all(|ok| ok)
            && registry_status_self_test().into_iter().all(|ok| ok)
            && autostart_registry_status_self_test()
                .into_iter()
                .all(|ok| ok)
            && autostart_xml_self_test().into_iter().all(|ok| ok)
            && registry_value_self_test().into_iter().all(|ok| ok)
            && load_generation_self_test().into_iter().all(|ok| ok)
            && save_sequence_self_test().into_iter().all(|ok| ok)
            && data_directory_self_test()
        {
            println!("SAVE POLICY GREEN (105/105)");
            std::process::exit(0);
        }
        println!("SAVE POLICY FAILED");
        std::process::exit(2);
    }
    if args.iter().any(|a| a == "--self-test-photo-policy") {
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
        if photo_policy_self_test()
            && photo_directory_self_test()
            && photo_catalog_self_test()
            && photo_write_self_test()
        {
            println!("PHOTO POLICY GREEN (71/71)");
            std::process::exit(0);
        }
        println!("PHOTO POLICY FAILED");
        std::process::exit(2);
    }
    if args.iter().any(|a| a == "--self-test-log-policy") {
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
        if crash_log_policy_self_test() {
            println!("LOG POLICY GREEN (33/33)");
            std::process::exit(0);
        }
        println!("LOG POLICY FAILED");
        std::process::exit(2);
    }
    if args.iter().any(|a| a == "--self-test-migration-policy") {
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
        if migration_policy_self_test() {
            println!("MIGRATION POLICY GREEN (24/24)");
            std::process::exit(0);
        }
        println!("MIGRATION POLICY FAILED");
        std::process::exit(2);
    }
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
        let body = format!("{info}");
        let _ = write_panic_log(&p, &body);
    }));

    // a companion that silently vanishes looks broken — ask Windows to
    // relaunch us after abnormal termination (WER crash, hang-kill).
    // RESTART_NO_REBOOT keeps the user's autostart choice authoritative
    // across reboots; clean Quit exits never trigger the restart.
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::System::Recovery::{RegisterApplicationRestart, RESTART_NO_REBOOT};
        RegisterApplicationRestart(std::ptr::null(), RESTART_NO_REBOOT);
    }

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
            reset_save,
            log_crash,
            save_png,
            is_demo,
            list_photos,
            load_photo,
            delete_photo,
            open_photos,
            open_url,
            verify_gem_code,
            redeem_bound,
            claim_grants,
            ack_grants,
            check_update,
            get_monitors,
            get_weather,
            set_autostart,
            is_store_build,
            autostart_available,
            iap_ready,
            iap_refresh,
            iap_buy,
            iap_products,
            iap_drain,
            iap_ack
        ])
        .setup(|app| {
            let window = required_runtime_value(app.get_webview_window("main"), "main window")?;

            // identifier migration: com.jellypal.app -> com.jellypal.desktop
            // (the .app suffix collides with macOS bundle semantics). If the
            // new data dir has no save but the old one does, copy everything
            // over so existing installs keep their slimes/photos/settings.
            if test_data_dir().is_none() {
                if let Ok(new_dir) = data_dir(app.handle()) {
                    if !new_dir.join("state.json").exists() {
                        let old_dir = app
                            .path()
                            .app_data_dir()
                            .ok()
                            .and_then(|d| d.parent().map(|p| p.join("com.jellypal.app")));
                        if let Some(old_dir) = old_dir {
                            if old_dir.join("state.json").exists() {
                                let mut stats = MigrationStats::default();
                                let _ = copy_legacy_tree(&old_dir, &new_dir, 0, &mut stats);
                            }
                        }
                    }
                }
            }

            let store_mode = is_store_build();
            // Cover the whole (primary) monitor.
            let mut mpos = tauri::PhysicalPosition::new(0, 0);
            let mut msize = tauri::PhysicalSize::new(1920, 1080);
            let mut scale = 1.0f64;
            // the store card keeps its configured size/position and stays
            // interactive — the fullscreen transparent overlay surgery below
            // belongs only to the desktop flavor
            if !store_mode {
            if let Some(monitor) = window.current_monitor()? {
                scale = monitor.scale_factor();
                msize = *monitor.size();
                mpos = *monitor.position();
            }
            // multi-monitor: stretch the overlay across the whole virtual
            // screen so slimes can wander between displays. positions can
            // be negative (secondary left/up of primary) — every consumer
            // already converts via (point - mpos) / scale, so only the
            // origin and size change. Per-monitor work areas go to the
            // frontend so each display gets a system-chrome-safe floor.
            if let Ok(mons) = window.available_monitors() {
                if !mons.is_empty() {
                    let mut minx = i32::MAX;
                    let mut miny = i32::MAX;
                    let mut maxx = i32::MIN;
                    let mut maxy = i32::MIN;
                    for m in &mons {
                        let p = m.position();
                        let s = m.size();
                        minx = minx.min(p.x);
                        miny = miny.min(p.y);
                        maxx = maxx.max(p.x + s.width as i32);
                        maxy = maxy.max(p.y + s.height as i32);
                    }
                    // work_area already excludes a pinned dock; only an
                    // auto-hiding one needs a manual reserve on its edge
                    let (dock_side, dock_px) = dock_reserve();
                    *lock_recover(&MON_LIST) = mons
                        .iter()
                        .map(|m| {
                            let r = m.work_area();
                            let (mut wx, wy, mut ww, mut wh) = (
                                (r.position.x - minx) as f64 / scale,
                                (r.position.y - miny) as f64 / scale,
                                r.size.width as f64 / scale,
                                r.size.height as f64 / scale,
                            );
                            match dock_side.as_str() {
                                "left" => { wx += dock_px; ww -= dock_px; }
                                "right" => { ww -= dock_px; }
                                "bottom" => { wh -= dock_px; }
                                _ => {}
                            }
                            if ww < 50.0 { ww = 50.0; }
                            if wh < 50.0 { wh = 50.0; }
                            [wx, wy, ww, wh]
                        })
                        .collect();
                    mpos = tauri::PhysicalPosition::new(minx, miny);
                    msize = tauri::PhysicalSize::new((maxx - minx) as u32, (maxy - miny) as u32);
                }
            }
            window.set_size(tauri::Size::Physical(msize))?;
            window.set_position(tauri::Position::Physical(mpos))?;
            // Explicitly clear both the native surface and WKWebView's
            // under-page color. This prevents a white flash/background on
            // macOS even when WebKit restores its opaque default.
            window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)))?;
            window.set_ignore_cursor_events(true)?;
            }

            // desktop companion shouldn't take a Dock slot on macOS — the
            // menu-bar tray icon is the only persistent UI affordance
            #[cfg(target_os = "macos")]
            app.handle()
                .set_activation_policy(tauri::ActivationPolicy::Accessory);

            let summon = MenuItem::with_id(app, "summon", "Summon", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&summon, &quit])?;
            let tray_icon = required_runtime_value(
                app.default_window_icon().cloned(),
                "default window icon",
            )?;
            TrayIconBuilder::with_id("tray")
                .icon(tray_icon)
                .tooltip("Jellypal")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "summon" => {
                        app.emit("summon", ()).ok();
                    }
                    // ask the frontend to flush its save first — the JS
                    // listener persists then invokes quit_app. the watchdog
                    // still force-exits so a wedged webview can't make Quit
                    // look broken
                    "quit" => {
                        app.emit("quit-request", ()).ok();
                        let app2 = app.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(2000));
                            app2.exit(0);
                        });
                    }
                    _ => {}
                })
                .build(app)?;

            // Click-through toggle: capture mouse only when it is over the pet
            // or an open UI panel. Everything else passes through.
            // The store card keeps the poll (cursor presence + always-on-top
            // reassert) but never flips click-through and never reads other
            // apps' window titles — the sandbox should see zero probing.
            let win_poll = window.clone();
            std::thread::spawn(move || {
                let mut inside = store_mode;
                let mut last_cur = (0.0f64, 0.0f64);
                let mut tick = 0u32;
                let mut flip_fail = 0u32;
                let mut held_stall = 0u32;
                loop {
                    // Update within one display frame. At 30ms a quick
                    // move-and-click could pass through before the overlay
                    // noticed that the cursor had entered a hit target.
                    std::thread::sleep(Duration::from_millis(12));
                    tick = next_poll_tick(tick);
                    if tick % 166 == 1 && !store_mode {
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
                            let title = bounded_focus_text(&aw.title, MAX_FOCUS_TITLE_CHARS);
                            let app_name = format!("{} {}", stem, aw.app_name).to_lowercase();
                            let app_name = bounded_focus_text(&app_name, MAX_FOCUS_APP_CHARS);
                            let _ = win_poll.emit("focus", [title, app_name]);
                        }
                    }
                    // global cursor position in physical screen px
                    let (cx, cy) = win_poll
                        .cursor_position()
                        .map(|p| (p.x as i32, p.y as i32))
                        .unwrap_or_default();
                    // overlay flavor: coords are relative to the virtual
                    // screen union pinned at setup. card flavor: relative to
                    // the card's own live position (it drifts — it is a
                    // user-dragged window, not a pinned overlay)
                    let (ox, oy, sc) = if store_mode {
                        let (wx, wy) = win_poll
                            .outer_position()
                            .map(|p| (p.x, p.y))
                            .unwrap_or_default();
                        (wx, wy, win_poll.scale_factor().unwrap_or(1.0))
                    } else {
                        (mpos.x, mpos.y, scale)
                    };
                    let lx = (cx - ox) as f64 / sc;
                    let ly = (cy - oy) as f64 / sc;
                    if (lx - last_cur.0).abs() + (ly - last_cur.1).abs() > 3.0 {
                        last_cur = (lx, ly);
                        let _ = win_poll.emit("cursor", [lx, ly]);
                    }
                    // windows silently demotes always-on-top windows after UAC
                    // prompts, lock screens and fullscreen takeovers — then the
                    // slimes vanish behind work windows. re-assert every ~3s;
                    // the call is idempotent so it costs nothing while healthy
                    if tick % 250 == 3 {
                        let _ = win_poll.set_always_on_top(true);
                    }
                    let now_inside = DRAGGING.load(Ordering::Relaxed)
                        || lock_recover(&CLICKABLE)
                            .iter()
                            .any(|r| {
                                lx >= r[0] && lx <= r[0] + r[2] && ly >= r[1] && ly <= r[1] + r[3]
                            });
                    // never flip click-through while a mouse button is held —
                    // toggling mid-gesture can deadlock the webview's input
                    // pipeline and hang the window. the held state is polled
                    // (no event tap), so it can't leak — but a stuck query or
                    // platform quirk could keep it true; force the flip after
                    // ~2s of divergence so a bad read can't freeze input
                    let btn_held = any_mouse_button_held();
                    let diverged = !store_mode && now_inside != inside;
                    held_stall = next_held_stall(held_stall, diverged, btn_held);
                    if diverged && (!btn_held || held_stall > 166) {
                        // only commit the state when the OS actually flipped —
                        // a swallowed error used to leave `inside` claiming
                        // enabled while the OS still ignored every event, and
                        // the `!=` guard meant the retry never ran: dead input
                        // until the cursor happened to leave and re-enter a rect
                        if win_poll.set_ignore_cursor_events(!now_inside).is_ok() {
                            inside = now_inside;
                        } else {
                            flip_fail = flip_fail.saturating_add(1);
                        }
                    }
                    // live click-state snapshot every ~1s — proves whether the
                    // frontend's rects arrived and whether the poll loop is
                    // alive, without needing the app to be instrumented
                    if tick % 83 == 2 {
                        if let Ok(dir) = data_dir(&win_poll.app_handle()) {
                            let n = lock_recover(&CLICKABLE).len();
                            let body = format!(
                                "{{\"inside\":{},\"rects\":{},\"cursor\":[{},{}],\"dragging\":{},\"flipfail\":{}}}",
                                inside,
                                n,
                                lx,
                                ly,
                                DRAGGING.load(Ordering::Relaxed),
                                flip_fail
                            );
                            let _ = write_atomic_regular(
                                &dir.join("clickdbg.json"),
                                body.as_bytes(),
                            );
                        }
                    }
                }
            });

            // Platform scan: top edges of every visible top-level window,
            // so the pet can sit on them. Emitted as logical-px [x, y, w].
            // Store build: the card's floor is its own bottom edge, and a
            // sandboxed app should not be enumerating other processes'
            // windows anyway — skip the thread entirely.
            let handle2 = app.handle().clone();
            let own_w = msize.width as i32;
            let own_h = msize.height as i32;
            if !store_mode {
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
            }

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

    #[test]
    fn focus_payload_text_is_unicode_safe_and_bounded() {
        assert_eq!(bounded_focus_text("Ab🙂Cd", 4), "Ab🙂C");
        let title = bounded_focus_text(
            &"창".repeat(MAX_FOCUS_TITLE_CHARS + 10),
            MAX_FOCUS_TITLE_CHARS,
        );
        let app = bounded_focus_text(&"x".repeat(MAX_FOCUS_APP_CHARS + 10), MAX_FOCUS_APP_CHARS);
        assert_eq!(title.chars().count(), MAX_FOCUS_TITLE_CHARS);
        assert_eq!(app.chars().count(), MAX_FOCUS_APP_CHARS);
    }
}
