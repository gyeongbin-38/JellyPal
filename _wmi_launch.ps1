$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "C:\Jellypal\jellypal.exe" }
Write-Host ("ReturnValue=" + $r.ReturnValue + " PID=" + $r.ProcessId)
Start-Sleep -Seconds 4
Get-Process -Id $r.ProcessId -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ("alive: " + $_.Id + " " + $_.Path) }
