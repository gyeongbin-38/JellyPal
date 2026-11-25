$exe = "$PSScriptRoot\src-tauri\target\release\jellypal.exe"
$bytes = [System.IO.File]::ReadAllBytes($exe)
$txt = [System.Text.Encoding]::ASCII.GetString($bytes)
"SERVER_URL in exe: " + $txt.Contains("jellypal-api.gyeongbin-38.workers.dev")
"exe timestamp: " + (Get-Item $exe).LastWriteTime
$nsis = Get-ChildItem "$PSScriptRoot\src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue
"nsis: " + ($nsis | ForEach-Object { "$($_.Name) $($_.LastWriteTime)" })
