Start-Process "C:\Jellypal\jellypal.exe"
Start-Sleep -Seconds 5
$p = Get-Process -Name jellypal -ErrorAction SilentlyContinue
if ($p) { $p | ForEach-Object { "RUNNING pid=$($_.Id) responding=$($_.Responding)" } }
else { "NOT RUNNING" }
