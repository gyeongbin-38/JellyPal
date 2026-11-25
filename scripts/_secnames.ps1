$secretsDir = if ($env:JP_SECRETS_DIR) { $env:JP_SECRETS_DIR } else { "$PSScriptRoot\..\typet-secrets" }
Get-Content "$secretsDir\_secrets.local.txt" | ForEach-Object {
  $k = ($_ -split '=', 2)[0]
  $v = ($_ -split '=', 2)[1]
  "$k = <hidden $($v.Length) chars>"
}
