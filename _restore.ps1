$ad = "$env:APPDATA\com.jellypal.desktop"
$old = "$env:APPDATA\com.jellypal.app"
Get-Process jellypal -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
if (Test-Path $ad) { Remove-Item $ad -Recurse -Force; "removed fresh test dir" }
if (Test-Path "$ad.real") { Rename-Item "$ad.real" "com.jellypal.desktop"; "restored desktop" }
if (Test-Path "$old.real") { Rename-Item "$old.real" "com.jellypal.app"; "restored app" }
Start-Process "C:\Jellypal\jellypal.exe"
Start-Sleep 8
$p = Get-Process jellypal -ErrorAction SilentlyContinue
if ($p) { "relaunched pid=$($p.Id) responding=$($p.Responding)" } else { "NOT RUNNING" }
"state.json present: $(Test-Path "$ad\state.json")"
