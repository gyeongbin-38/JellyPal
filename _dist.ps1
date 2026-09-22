# repack dist + rebuild NSIS installer (TAURI_CONFIG keeps windres off the
# Korean path — see _build_ascii.ps1)
Set-Location C:\dev\mini\typet
$zip = "dist\jellypal-0.2.0-win.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "src-tauri\target\release\jellypal.exe", "src-tauri\target\release\WebView2Loader.dll" -DestinationPath $zip
Write-Output "zip: $((Get-Item $zip).Length) bytes"
$env:TAURI_CONFIG = '{"bundle":{"icon":["C:/Jellypal/icon.ico"]}}'
$env:RUSTFLAGS = "--remap-path-prefix=C:\dev\mini\typet=jellypal --remap-path-prefix=C:\cargo2\registry\src=crates"
npx tauri build
exit $LASTEXITCODE
