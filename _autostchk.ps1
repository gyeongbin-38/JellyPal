$rk = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Get-ItemProperty $rk | Get-Member -MemberType NoteProperty | Where-Object Name -match "jelly|Jelly" | ForEach-Object { $_.Name }
$v = (Get-ItemProperty $rk).Jellypal
"Jellypal run key: $v"
if ($v) { "points at existing file: $(Test-Path ($v.Trim('\"')))" }
