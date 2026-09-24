$jp = Get-Process -Name jellypal -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $jp) { "jellypal NOT RUNNING"; exit }
"jellypal pid=$($jp.Id)"
$wvs = Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
  Where-Object { $_.ParentProcessId -eq $jp.Id -or $_.CommandLine -match "jellypal|typet" }
if ($wvs) {
  $wvs | ForEach-Object { "  wv2 pid=$($_.ProcessId) parent=$($_.ParentProcessId)" }
} else {
  "  NO webview2 children for jellypal pid $($jp.Id)"
  # show all wv2 parents for comparison
  Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
    Group-Object ParentProcessId | ForEach-Object { "  parent pid $($_.Name): $($_.Count) wv2 procs" }
}
