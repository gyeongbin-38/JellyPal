cd C:\dev\mini\typet
$env:TAURI_CONFIG = '{"bundle":{"icon":["C:/dev/assets/icon.ico"]}}'
$env:RUSTFLAGS = "--remap-path-prefix=C:\dev\mini\typet=app --remap-path-prefix=C:\cargo2\registry\src=cargo"
npm run tauri -- build --bundles nsis 2>&1 | Select-Object -Last 15
