$ErrorActionPreference = "Continue"
"=== 1. kill ziptest instance ==="
Get-Process jellypal -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

"=== 2. silent install ==="
$setup = "C:\dev\mini\typet\dist\Jellypal_0.2.0_x64-setup.exe"
Start-Process $setup -ArgumentList "/S" -Wait
"installer exit done"
Start-Sleep 3

"=== 3. find installed files ==="
$cand = @(
  "$env:LOCALAPPDATA\Programs\Jellypal",
  "$env:LOCALAPPDATA\Jellypal",
  "$env:ProgramFiles\Jellypal"
)
foreach ($c in $cand) { if (Test-Path $c) { "FOUND: $c"; Get-ChildItem $c -Recurse | ForEach-Object { "  $($_.Name) $($_.Length)" } } }
"--- shortcuts ---"
Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs" -Recurse -Filter "*ellypal*" -ErrorAction SilentlyContinue | ForEach-Object { "  startmenu: $($_.FullName)" }
Get-ChildItem "$env:USERPROFILE\Desktop" -Filter "*ellypal*" -ErrorAction SilentlyContinue | ForEach-Object { "  desktop: $($_.Name)" }
"--- uninstall registry ---"
$un = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object DisplayName -match "Jellypal"
$un | ForEach-Object { "  regkey: $($_.PSChildName)  loc: $($_.InstallLocation)  ver: $($_.DisplayVersion)" }
