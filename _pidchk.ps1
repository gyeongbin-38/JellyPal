Get-Process jellypal -ErrorAction SilentlyContinue | Select-Object Id, Path, StartTime, Responding
$exe = Get-Item "C:\Jellypal\jellypal.exe"
Write-Output "installed exe: $($exe.Length) bytes, $($exe.LastWriteTime)"
$dbg = "$env:APPDATA\com.jellypal.desktop\clickdbg.json"
if (Test-Path $dbg) { Write-Output "clickdbg mtime: $((Get-Item $dbg).LastWriteTime)" }
$st = "$env:APPDATA\com.jellypal.desktop\state.json"
if (Test-Path $st) { Write-Output "state mtime: $((Get-Item $st).LastWriteTime)" }
