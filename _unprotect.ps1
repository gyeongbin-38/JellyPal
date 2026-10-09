param([Parameter(Mandatory=$true)][string]$Path)
Add-Type -AssemblyName System.Security
$raw = [System.IO.File]::ReadAllText($Path).Trim()
if ($raw.StartsWith('JPENC1:')) {
  $blob = [Convert]::FromBase64String($raw.Substring(7))
  $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($blob, $null, 'CurrentUser')
  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))
} else {
  [Console]::Out.Write($raw)
}
