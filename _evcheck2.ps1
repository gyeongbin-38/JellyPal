# look for any jellypal-related or WebView2-related events in the last 12h
$since = (Get-Date).AddHours(-12)
Write-Host "=== Application log: jellypal / msedgewebview2 / Application Error / AppHang ==="
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$since} -ErrorAction SilentlyContinue |
  Where-Object { $_.Message -match 'jellypal|msedgewebview|WebView2' -or $_.ProviderName -match 'Application Error|Windows Error Reporting|Application Hang' } |
  Select-Object TimeCreated, Id, ProviderName, @{N='Msg';E={$_.Message.Substring(0,[Math]::Min(300,$_.Message.Length))}} |
  Format-List
Write-Host "=== System log: anything mentioning jellypal ==="
Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$since} -ErrorAction SilentlyContinue |
  Where-Object { $_.Message -match 'jellypal' } |
  Select-Object TimeCreated, Id, ProviderName, @{N='Msg';E={$_.Message.Substring(0,[Math]::Min(200,$_.Message.Length))}} |
  Format-List
Write-Host "=== done ==="
