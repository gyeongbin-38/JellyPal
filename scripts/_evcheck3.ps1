$since = (Get-Date).AddHours(-3)
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$since} -MaxEvents 3000 -ErrorAction SilentlyContinue |
  Where-Object { $_.Message -match 'jellypal' -or ($_.ProviderName -match 'Application Hang|Application Error|Windows Error Reporting' -and $_.Message -match 'jellypal') } |
  Select-Object TimeCreated, ProviderName, Id, @{n='Msg';e={$_.Message.Substring(0,[Math]::Min(300,$_.Message.Length))}} |
  Format-List
Write-Host "---done---"
