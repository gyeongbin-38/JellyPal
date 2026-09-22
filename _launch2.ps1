Start-Process 'C:\Jellypal\jellypal.exe'
Start-Sleep 3
Write-Output "== after 2nd launch =="
Get-Process jellypal -ErrorAction SilentlyContinue | Select-Object Id, Responding | Format-Table
