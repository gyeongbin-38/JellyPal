$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\server"
$secrets = @{}
$secretsDir = if ($env:JP_SECRETS_DIR) { $env:JP_SECRETS_DIR } else { "$PSScriptRoot\..\typet-secrets" }
Get-Content "$secretsDir\_secrets.local.txt" | ForEach-Object {
  $p = $_ -split '=', 2
  $secrets[$p[0].Trim()] = $p[1].Trim()
}
foreach ($name in @('SERVER_SK', 'ADMIN_KEY')) {
  $secrets[$name] | npx wrangler secret put $name 2>&1 | ForEach-Object {
    if ($_ -notmatch $secrets[$name]) { $_ }
  }
}
