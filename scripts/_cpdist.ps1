$nsis = "C:\dev\mini\typet\src-tauri\target\release\bundle\nsis\Jellypal_0.2.0_x64-setup.exe"
Copy-Item $nsis "C:\dev\mini\typet\dist\Jellypal_0.2.0_x64-setup.exe" -Force
Copy-Item "C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip" "C:\dev\mini\typet\site\dl\jellypal-0.2.0-win.zip" -Force
Copy-Item "C:\dev\mini\typet\dist\Jellypal_0.2.0_x64-setup.exe" "C:\dev\mini\typet\site\dl\Jellypal_0.2.0_x64-setup.exe" -Force
"dist + site/dl synced:"
Get-ChildItem "C:\dev\mini\typet\dist","C:\dev\mini\typet\site\dl" | ForEach-Object { "  $($_.Name) $($_.Length)" }
