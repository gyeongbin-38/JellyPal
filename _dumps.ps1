$paths = @(
  "$env:LOCALAPPDATA\com.jellypal.desktop",
  "$env:LOCALAPPDATA\Jellypal",
  "C:\Jellypal",
  "$env:LOCALAPPDATA\Microsoft\EdgeWebView"
)
foreach ($p in $paths) {
  if (Test-Path $p) {
    $d = Get-ChildItem $p -Recurse -Include "*.dmp","Crashpad" -ErrorAction SilentlyContinue | Select-Object -First 10
    if ($d) { "== $p =="; $d | ForEach-Object { "  $($_.FullName) $($_.LastWriteTime)" } }
  }
}
"--- EBWebView dirs ---"
Get-ChildItem "$env:LOCALAPPDATA" -Directory -ErrorAction SilentlyContinue | Where-Object Name -match "jelly|EBWeb" | ForEach-Object { $_.FullName }
Get-ChildItem "C:\Jellypal" -Directory -ErrorAction SilentlyContinue | ForEach-Object { "C:\Jellypal\$($_.Name)" }
