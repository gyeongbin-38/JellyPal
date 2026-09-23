$a = (Get-FileHash "C:\Jellypal\jellypal.exe").Hash
$b = (Get-FileHash "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe").Hash
Write-Output ("installed: " + $a)
Write-Output ("release:   " + $b)
Write-Output ("MATCH: " + ($a -eq $b))
Write-Output ((Get-Item "C:\Jellypal\jellypal.exe").LastWriteTime)
Write-Output ((Get-Item "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe").LastWriteTime)
