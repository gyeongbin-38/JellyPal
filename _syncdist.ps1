$ErrorActionPreference = "Continue"
$exe = "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe"
"latest exe: $((Get-Item $exe).Length)B $((Get-Item $exe).LastWriteTime)"

# refresh zip
$stage = "C:\dev\mini\typet\_zipstage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item $stage -ItemType Directory | Out-Null
Copy-Item $exe "$stage\jellypal.exe"
Copy-Item "C:\dev\mini\typet\src-tauri\WebView2Loader.dll" "$stage\WebView2Loader.dll"
$zip = "C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive "$stage\*" $zip
"zip: $((Get-Item $zip).Length)B"

# installer to dist
$nsis = "C:\dev\mini\typet\src-tauri\target\release\bundle\nsis\Jellypal_0.2.0_x64-setup.exe"
Copy-Item $nsis "C:\dev\mini\typet\dist\Jellypal_0.2.0_x64-setup.exe" -Force
"installer: $((Get-Item C:\dev\mini\typet\dist\Jellypal_0.2.0_x64-setup.exe).Length)B"

# update installed copy + restart
Get-Process jellypal -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
Copy-Item $exe C:\Jellypal\jellypal.exe -Force
Start-Process C:\Jellypal\jellypal.exe
"relaunched"
