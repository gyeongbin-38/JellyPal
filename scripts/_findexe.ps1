$paths = @(
  "C:\Jellypal\jellypal.exe",
  "$env:LOCALAPPDATA\Jellypal\jellypal.exe",
  "$env:LOCALAPPDATA\Programs\Jellypal\jellypal.exe",
  "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe",
  "C:\dev\mini\typet\_installtest\jellypal.exe",
  "$env:ProgramFiles\Jellypal\jellypal.exe",
  "${env:ProgramFiles(x86)}\Jellypal\jellypal.exe"
)
foreach ($p in $paths) {
  if (Test-Path $p) {
    $f = Get-Item $p
    Write-Host ("FOUND " + $f.FullName + "  " + $f.LastWriteTime + "  " + $f.Length)
  }
}
Write-Host "--- running ---"
Get-Process jellypal -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ($_.Id.ToString() + " " + $_.Path) }
Write-Host "--- uninstall registry entries ---"
$reg = @("HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*")
foreach ($r in $reg) { Get-ItemProperty $r -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*jelly*" -or $_.DisplayName -like "*Jellypal*" } | ForEach-Object { Write-Host ($_.DisplayName + " | " + $_.InstallLocation + " | " + $_.UninstallString) } }
Write-Host "--- start menu shortcuts ---"
Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu" -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*jelly*" } | ForEach-Object { Write-Host $_.FullName }
