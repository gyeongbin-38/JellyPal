Get-Content "$PSScriptRoot\_secrets.local.txt" | ForEach-Object {
  $k = ($_ -split '=', 2)[0]
  $v = ($_ -split '=', 2)[1]
  "$k = <hidden $($v.Length) chars>"
}
