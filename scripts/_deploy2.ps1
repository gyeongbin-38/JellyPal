$ErrorActionPreference = "Continue"
$exe = "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe"
"new exe: $((Get-Item $exe).Length)B $((Get-Item $exe).LastWriteTime)"

Get-Process jellypal -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
Copy-Item $exe C:\Jellypal\jellypal.exe -Force
"installed copy updated"

Start-Process C:\Jellypal\jellypal.exe
Start-Sleep 10
$p = Get-Process jellypal -ErrorAction SilentlyContinue
"running: pid=$($p.Id) responding=$($p.Responding)"

# refresh zip with identical exe
$stage = "C:\dev\mini\typet\_zipstage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item $stage -ItemType Directory | Out-Null
Copy-Item $exe "$stage\jellypal.exe"
Copy-Item "C:\dev\mini\typet\src-tauri\WebView2Loader.dll" "$stage\WebView2Loader.dll"
$zip = "C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive "$stage\*" $zip
"zip rebuilt: $((Get-Item $zip).Length)B"
