$ErrorActionPreference = "Continue"
$exe = "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe"
$stage = "C:\dev\mini\typet\_zipstage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item $stage -ItemType Directory | Out-Null
Copy-Item $exe "$stage\jellypal.exe"
Copy-Item "C:\dev\mini\typet\src-tauri\WebView2Loader.dll" "$stage\WebView2Loader.dll"
$zip = "C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive "$stage\*" $zip
"zip: $((Get-Item $zip).Length)B"
