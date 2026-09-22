$ErrorActionPreference = 'SilentlyContinue'
$since = (Get-Date).AddHours(-3)
Write-Host "=== Application Error / Hang entries mentioning jellypal ==="
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$since} |
  Where-Object { $_.Message -match 'jellypal' } |
  Select-Object TimeCreated, Id, ProviderName, @{n='Msg';e={$_.Message.Substring(0,[Math]::Min(300,$_.Message.Length))}} |
  Format-List
Write-Host "=== System log: sleep/resume/display events ==="
Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$since} |
  Where-Object { $_.Id -in 42,107,506,507 -or $_.Message -match 'sleep|resume|display|graphics|tdr' } |
  Select-Object TimeCreated, Id, ProviderName |
  Format-Table -AutoSize
