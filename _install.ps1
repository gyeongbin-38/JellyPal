# hot-swap the installed exe. RegisterApplicationRestart relaunches a killed
# instance within a second or two, so kill -> copy must be back-to-back with
# no sleep in between; retry until the copy lands before the relaunch locks it
$src = "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe"
$dst = "C:\Jellypal\jellypal.exe"
for ($i = 0; $i -lt 8; $i++) {
  Stop-Process -Name jellypal -Force -ErrorAction SilentlyContinue
  try {
    Copy-Item -Force $src $dst -ErrorAction Stop
    break
  } catch {
    Start-Sleep -Milliseconds 400
  }
}
$exe = Get-Item $dst
Write-Output "installed: $($exe.Length) bytes @ $($exe.LastWriteTime)"
Start-Process $dst
Start-Sleep -Seconds 6
$p = Get-Process jellypal -ErrorAction SilentlyContinue
if ($p) { Write-Output "running: pid $($p.Id), responding $($p.Responding)" } else { Write-Output "NOT RUNNING" }
