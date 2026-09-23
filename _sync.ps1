# sync built artifacts: install dir, portable zip, dist installer, release
Set-Location C:\dev\mini\typet
Copy-Item -Force "src-tauri\target\release\jellypal.exe" "C:\Jellypal\jellypal.exe"
Copy-Item -Force "src-tauri\target\release\bundle\nsis\Jellypal_0.2.0_x64-setup.exe" "dist\Jellypal_0.2.0_x64-setup.exe"
$zip = "dist\jellypal-0.2.0-win.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "src-tauri\target\release\jellypal.exe", "src-tauri\target\release\WebView2Loader.dll" -DestinationPath $zip
Write-Output "exe: $((Get-Item src-tauri\target\release\jellypal.exe).Length)"
Write-Output "zip: $((Get-Item $zip).Length)"
Write-Output "setup: $((Get-Item dist\Jellypal_0.2.0_x64-setup.exe).Length)"
Get-FileHash "src-tauri\target\release\jellypal.exe" | Select-Object -ExpandProperty Hash
