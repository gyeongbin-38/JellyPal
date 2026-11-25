$p = Get-Process -Name jellypal -ErrorAction SilentlyContinue
if ($p) { $p | ForEach-Object { "RUNNING pid=$($_.Id) path=$($_.Path) responding=$($_.Responding)" } }
else { "NOT RUNNING" }
