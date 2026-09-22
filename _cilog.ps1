param([string]$Job)
$lines = gh run view --job $Job --log 2>&1
$idx = ($lines | Select-String -Pattern 'error\[' | Select-Object -First 1).LineNumber
if ($idx) { $lines[($idx-2)..([Math]::Min($idx+90, $lines.Count-1))] } else { $lines | Select-Object -Last 60 }
