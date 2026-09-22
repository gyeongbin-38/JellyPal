Copy-Item 'C:\dev\mini\typet\src-tauri\target\release\bundle\nsis\Jellypal_0.2.0_x64-setup.exe' 'C:\dev\mini\typet\dist\Jellypal_0.2.0_x64-setup.exe' -Force
Get-ChildItem 'C:\dev\mini\typet\dist' | Select-Object Name, Length, LastWriteTime
