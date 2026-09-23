Stop-Process -Name jellypal -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Copy-Item -Force "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe" "C:\Jellypal\jellypal.exe"
$exe = Get-Item "C:\Jellypal\jellypal.exe"
Write-Output "installed: $($exe.Length) bytes @ $($exe.LastWriteTime)"
Start-Process "C:\Jellypal\jellypal.exe"
Start-Sleep -Seconds 6
$p = Get-Process jellypal -ErrorAction SilentlyContinue
if ($p) { Write-Output "running: pid $($p.Id), responding $($p.Responding)" } else { Write-Output "NOT RUNNING" }
