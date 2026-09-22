$log = Join-Path $env:APPDATA "com.jellypal.app\crash.log"
Write-Output ("log exists: " + (Test-Path $log))
$lines = Get-Content $log
Write-Output ("total lines: " + $lines.Count)
Write-Output "--- last 30 ---"
$lines | Select-Object -Last 30
Write-Output "--- UNLOAD/ERR markers ---"
$lines | Where-Object { $_ -match "UNLOAD|JSERR|JSREJ|FRAME|GRAB-STUCK|WEDG" } | Select-Object -Last 15
