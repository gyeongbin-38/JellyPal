$base = "$env:APPDATA\xdg.config\.wrangler"
if (-not (Test-Path $base)) { $base = "$env:USERPROFILE\AppData\Roaming\xdg.config\.wrangler" }
Write-Output ("base: " + $base + " exists=" + (Test-Path $base))
if (Test-Path $base) {
  Get-ChildItem $base -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ($_.LastWriteTime.ToString("HH:mm:ss") + "  " + $_.FullName) }
}
