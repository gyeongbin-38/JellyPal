param([string]$Run = "35753583796")
$a = gh api repos/gyeongbin-38/JellyPal/actions/runs/$Run/artifacts | ConvertFrom-Json
"count: $($a.total_count)"
$a.artifacts | ForEach-Object { "$($_.name)  $($_.size_in_bytes)B" }
