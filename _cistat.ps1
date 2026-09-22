param([string]$Run = "35751705887")
$j = gh run view $Run --json status,conclusion,jobs | ConvertFrom-Json
"$($j.status) $($j.conclusion)"
$j.jobs | ForEach-Object { "  $($_.name): $($_.status) $($_.conclusion)" }
