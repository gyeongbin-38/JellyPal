Get-Item "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe" -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime
Get-Item "C:\dev\mini\typet\src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime
Get-Process jellypal -ErrorAction SilentlyContinue | Select-Object Id, StartTime
