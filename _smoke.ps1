$j = gh run view 35851124424 --json jobs | ConvertFrom-Json
$b = $j.jobs | Where-Object { $_.name -eq "bundle" }
$l = gh run view --job $b.databaseId --log 2>&1
$idx = ($l | Select-String -Pattern "alive after 20s|FAIL:" | Select-Object -First 1).LineNumber
"match line: $idx"
if ($idx) { $l[([Math]::Max(0,$idx-8))..([Math]::Min($idx+35, $l.Count-1))] | ForEach-Object { $_.Substring([Math]::Max(0,$_.IndexOf("Z ")+1)) } }
