Start-Process "C:\Jellypal\jellypal.exe"
Start-Sleep -Seconds 8
$p = Get-Process jellypal -ErrorAction SilentlyContinue
if ($p) { Write-Output "running: pid $($p.Id), responding $($p.Responding)" } else { Write-Output "NOT RUNNING" }
$sf = "$env:APPDATA\com.jellypal.desktop\state.json"
if (Test-Path $sf) {
  $s = Get-Content $sf -Raw | ConvertFrom-Json
  Write-Output "uid: $($s.uid)"
  Write-Output "claimed: $($s.claimed -join ',')"
}
