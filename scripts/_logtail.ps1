$cl = "$env:APPDATA\com.jellypal.desktop\crash.log"
"--- crash.log tail ---"
Get-Content $cl -Tail 25
"--- file time: $((Get-Item $cl).LastWriteTime) ---"
