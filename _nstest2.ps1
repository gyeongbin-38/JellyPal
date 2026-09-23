$ErrorActionPreference = "Continue"
"=== installed files at C:\Jellypal ==="
Get-ChildItem C:\Jellypal | ForEach-Object { "  $($_.Name)  $($_.Length)B  $($_.LastWriteTime)" }

"=== launch installed exe ==="
Start-Process "C:\Jellypal\jellypal.exe"
Start-Sleep 10
$p = Get-Process jellypal -ErrorAction SilentlyContinue
$p | ForEach-Object { "  pid=$($_.Id) path=$($_.Path) responding=$($_.Responding)" }

"=== uninstall (silent) ==="
$un = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object DisplayName -match "Jellypal"
"uninstall string: $($un.UninstallString)"
Get-Process jellypal -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
$uexe = $un.UninstallString.Trim('"')
Start-Process $uexe -ArgumentList "/S" -Wait
Start-Sleep 3
"C:\Jellypal exists after uninstall: $(Test-Path C:\Jellypal)"
if (Test-Path C:\Jellypal) { Get-ChildItem C:\Jellypal | ForEach-Object { "  left: $($_.Name)" } }
"uninstall reg still there: $([bool](Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -match 'Jellypal'))"
"appdata preserved: $(Test-Path "$env:APPDATA\com.jellypal.desktop\state.json")"
