$ErrorActionPreference = "Continue"
$ad = "$env:APPDATA\com.jellypal.desktop"
$old = "$env:APPDATA\com.jellypal.app"

"=== 1. kill running instance ==="
Get-Process jellypal -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

"=== 2. move existing data aside ==="
if (Test-Path $ad) { Rename-Item $ad "com.jellypal.desktop.real"; "moved desktop -> .real" }
if (Test-Path $old) { Rename-Item $old "com.jellypal.app.real"; "moved app -> .real" }
"AD clean: $(-not (Test-Path $ad))"

"=== 3. launch from installed location ==="
Start-Process "C:\Jellypal\jellypal.exe"
Start-Sleep 15

"=== 4. verify ==="
$p = Get-Process jellypal -ErrorAction SilentlyContinue
if ($p) { "PASS: alive pid=$($p.Id) responding=$($p.Responding)" } else { "FAIL: not running" }
"data dir created: $(Test-Path $ad)"
if (Test-Path $ad) { Get-ChildItem $ad | ForEach-Object { "  $($_.Name) $($_.Length)" } }
$cl = "$ad\crash.log"
if (Test-Path $cl) { "--- crash.log tail ---"; Get-Content $cl -Tail 8 }
