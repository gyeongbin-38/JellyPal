$r = gh release view v0.2.0 --json assets | ConvertFrom-Json
$r.assets | ForEach-Object { "$($_.name)  $($_.size)" }
