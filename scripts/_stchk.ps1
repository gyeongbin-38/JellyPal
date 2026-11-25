$p = Get-Process jellypal -ErrorAction SilentlyContinue
if ($p) { $p | ForEach-Object { "pid=$($_.Id) responding=$($_.Responding) ws=$([math]::Round($_.WorkingSet64/1MB))MB" } } else { "not running" }
"zip exists: $(Test-Path C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip)"
if (Test-Path C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip) { "zip size: $((Get-Item C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip).Length)" }
$cl = "$env:APPDATA\com.jellypal.desktop\crash.log"
Get-Content $cl -Tail 5
