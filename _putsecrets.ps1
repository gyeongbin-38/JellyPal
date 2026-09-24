$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\server"
$secrets = @{}
Get-Content "$PSScriptRoot\_secrets.local.txt" | ForEach-Object {
  $p = $_ -split '=', 2
  $secrets[$p[0].Trim()] = $p[1].Trim()
}
foreach ($name in @('SERVER_SK', 'ADMIN_KEY')) {
  $secrets[$name] | npx wrangler secret put $name 2>&1 | ForEach-Object {
    if ($_ -notmatch $secrets[$name]) { $_ }
  }
}
