$ErrorActionPreference = "Stop"
$exe = "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe"
$zip = "C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip"
# stage a clean folder
$stage = "C:\dev\mini\typet\_zipstage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item $exe "$stage\jellypal.exe"
Get-ChildItem "C:\dev\mini\typet\src-tauri\target\release" -Filter *.dll | ForEach-Object { Copy-Item $_.FullName $stage }
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$stage\*" -DestinationPath $zip -CompressionLevel Optimal
Remove-Item $stage -Recurse -Force
Write-Output ("zip rebuilt: " + (Get-Item $zip).Length + " bytes")
# refresh installed copy (kill first — RegisterApplicationRestart may relaunch)
$proc = Get-Process jellypal -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq "C:\Jellypal\jellypal.exe" }
if ($proc) { $proc | Stop-Process -Force }
$ok = $false
for ($i = 0; $i -lt 10 -and -not $ok; $i++) {
  try { Copy-Item $exe "C:\Jellypal\jellypal.exe" -Force; $ok = $true }
  catch { Start-Sleep -Milliseconds 700 }
}
if (-not $ok) { Write-Output "INSTALL COPY FAILED"; exit 1 }
Write-Output "installed copy updated"
Start-Process "C:\Jellypal\jellypal.exe"
