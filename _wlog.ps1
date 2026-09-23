$d = Join-Path $env:APPDATA "xdg.config\.wrangler\logs"
Get-ChildItem $d -Filter *.log | Sort-Object LastWriteTime -Descending | Select-Object -First 2 | ForEach-Object {
  Write-Output ("=== " + $_.Name + " ===")
  Get-Content $_.FullName -Tail 18 -ErrorAction SilentlyContinue
}
