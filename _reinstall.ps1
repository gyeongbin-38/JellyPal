$old = Get-Process jellypal -ErrorAction SilentlyContinue
if ($old) {
  Write-Output "stopping PID $($old.Id)..."
  $old | Stop-Process -Force
  Start-Sleep -Milliseconds 800
}
Copy-Item -Force "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe" "C:\Jellypal\jellypal.exe"
Copy-Item -Force "C:\dev\mini\typet\src-tauri\target\release\WebView2Loader.dll" "C:\Jellypal\WebView2Loader.dll" -ErrorAction SilentlyContinue
Write-Output "installed: $((Get-Item 'C:\Jellypal\jellypal.exe').LastWriteTime)"
# launch via WMI so the process outlives this shell session
$r = ([wmiclass]"Win32_Process").Create("C:\Jellypal\jellypal.exe")
Write-Output "launch result: $($r.ReturnValue) pid: $($r.ProcessId)"
Start-Sleep -Seconds 3
$p = Get-Process -Id $r.ProcessId -ErrorAction SilentlyContinue
if ($p) { Write-Output "ALIVE pid=$($p.Id) title='$($p.MainWindowTitle)' responding=$($p.Responding)" } else { Write-Output "DIED IMMEDIATELY" }
