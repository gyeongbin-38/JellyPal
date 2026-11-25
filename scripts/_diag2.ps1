Write-Output "== recent app errors =="
Get-WinEvent -LogName Application -MaxEvents 3000 -ErrorAction SilentlyContinue |
    Where-Object { $_.TimeCreated -gt (Get-Date).AddMinutes(-20) -and $_.Message -match 'jellypal' } |
    Select-Object TimeCreated, Id, LevelDisplayName, @{n='Msg';e={$_.Message.Substring(0,[Math]::Min(300,$_.Message.Length))}} |
    Format-List
Write-Output "== done =="
