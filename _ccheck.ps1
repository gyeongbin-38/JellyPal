Copy-Item -Force "C:\dev\mini\typet\src-tauri\icons\icon.ico" "C:\Jellypal\icon.ico"
$env:TAURI_CONFIG = '{"bundle":{"icon":["C:/Jellypal/icon.ico"]}}'
Set-Location "C:\dev\mini\typet\src-tauri"
cargo check
exit $LASTEXITCODE
