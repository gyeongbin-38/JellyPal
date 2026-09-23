$ev = Get-WinEvent -FilterHashtable @{LogName='Application'} -MaxEvents 4000 -ErrorAction SilentlyContinue |
  Where-Object { $_.Message -match 'jellypal' -or $_.ProviderName -match 'Application Error|Windows Error Reporting|Application Hang' }
$ev | Select-Object -First 15 | ForEach-Object {
  "[$($_.TimeCreated)] $($_.ProviderName) id=$($_.Id)"
  ($_.Message -split "`n" | Select-Object -First 4) | ForEach-Object { "    $_" }
}
"count: $($ev.Count)"
