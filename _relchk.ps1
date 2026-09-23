$r = gh release view v0.2.0 --json assets | ConvertFrom-Json
$r.assets | ForEach-Object { "$($_.name)  $($_.size)B  digest=$($_.digest)" }
"--- local dist ---"
Get-ChildItem C:\dev\mini\typet\dist | ForEach-Object {
  "sha256:$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name) $($_.Length)B"
}
