$a = gh api repos/gyeongbin-38/JellyPal/actions/runs/35751931358/artifacts | ConvertFrom-Json
"count: $($a.total_count)"
$a.artifacts | ForEach-Object { "$($_.name)  $($_.size_in_bytes)B" }
