$e = Get-Item "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe" -ErrorAction SilentlyContinue
"exe: " + $(if ($e) { $e.LastWriteTime.ToString("HH:mm:ss") } else { "missing" })
Get-ChildItem "C:\dev\mini\typet\src-tauri\target\release\bundle\nsis" -ErrorAction SilentlyContinue | ForEach-Object { "nsis: $($_.Name) $($_.LastWriteTime.ToString('HH:mm:ss'))" }
Get-Process jellypal -ErrorAction SilentlyContinue | ForEach-Object { "running: $($_.Id)" }
