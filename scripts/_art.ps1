$paths = @(
  'C:\dev\mini\typet\src-tauri\target\release\jellypal.exe',
  'C:\dev\mini\typet\src-tauri\target\release\bundle\nsis\Jellypal_0.2.0_x64-setup.exe'
)
foreach ($p in $paths) {
  if (Test-Path $p) { $f = Get-Item $p; Write-Output "$($f.Name) $($f.Length) $($f.LastWriteTime)" }
  else { Write-Output "MISSING $p" }
}
