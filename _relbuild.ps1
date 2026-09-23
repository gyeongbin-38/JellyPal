$ErrorActionPreference = "Continue"
cd C:\dev\mini\typet\src-tauri
$env:TAURI_CONFIG = '{"bundle":{"icon":["C:/dev/assets/icon.ico"]}}'
$env:RUSTFLAGS = "--remap-path-prefix=C:\dev\mini\typet=app --remap-path-prefix=C:\cargo2\registry\src=cargo"
cargo build --release 2>&1 | Select-Object -Last 6
