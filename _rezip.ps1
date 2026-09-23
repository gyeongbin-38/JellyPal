$ErrorActionPreference = "Stop"
$exe = "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe"
$dll = "C:\dev\mini\typet\src-tauri\target\release\WebView2Loader.dll"
if (-not (Test-Path $dll)) { $dll = "C:\dev\mini\typet\src-tauri\WebView2Loader.dll" }
"exe: $((Get-Item $exe).Length)B $((Get-Item $exe).LastWriteTime)"
"dll: $dll ($(Test-Path $dll))"

$stage = "C:\dev\mini\typet\_zipstage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item $stage -ItemType Directory | Out-Null
Copy-Item $exe "$stage\jellypal.exe"
Copy-Item $dll "$stage\WebView2Loader.dll"

$zip = "C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive "$stage\*" $zip
"zip: $((Get-Item $zip).Length)B"

# reinstall app for user
Start-Process "C:\dev\mini\typet\dist\Jellypal_0.2.0_x64-setup.exe" -ArgumentList "/S" -Wait
Start-Sleep 3
Start-Process "C:\Jellypal\jellypal.exe"
Start-Sleep 8
$p = Get-Process jellypal -ErrorAction SilentlyContinue
"reinstalled+running: pid=$($p.Id) path=$($p.Path) responding=$($p.Responding)"
