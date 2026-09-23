$cl = "$env:APPDATA\com.jellypal.desktop\crash.log"
$lines = Get-Content $cl
"total lines: $($lines.Count)"
"--- non-tick markers ---"
$lines | Select-String -Pattern "UNLOAD|JSERR|EXIT|PANIC|GRAB|hook|boot|start" | Select-Object -Last 20
"--- session gaps (>5min between ticks) ---"
$prev = 0
$gaps = @()
foreach ($l in $lines) {
  if ($l -match '^\[(\d+)\] tick') {
    $t = [long]$Matches[1]
    if ($prev -gt 0 -and ($t - $prev) -gt 300000) { $gaps += "gap $([math]::Round(($t-$prev)/60000,1))min before ts $t" }
    $prev = $t
  }
}
"gaps: $($gaps.Count)"; $gaps | Select-Object -Last 10
"--- last tick ts: $prev  now: $([long]([DateTimeOffset]::Now.ToUnixTimeMilliseconds()))"
"--- running instances ---"
Get-Process jellypal -ErrorAction SilentlyContinue | ForEach-Object { "pid=$($_.Id) path=$($_.Path) started=$($_.StartTime)" }
