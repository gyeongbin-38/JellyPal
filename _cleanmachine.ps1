# clean-machine audit: what does the installed app actually need?
$ErrorActionPreference = "Continue"
Write-Output "=== 1. installed dir contents ==="
Get-ChildItem C:\Jellypal | Format-Table Name, Length -AutoSize | Out-String -Width 200

Write-Output "=== 2. exe dependencies (DLL imports) ==="
# list imported DLLs via dumpbin-free approach: read PE import names
$bytes = [System.IO.File]::ReadAllBytes("C:\Jellypal\jellypal.exe")
$txt = [System.Text.Encoding]::ASCII.GetString($bytes)
$dlls = [regex]::Matches($txt, "[A-Za-z0-9_\-]+\.dll") | ForEach-Object { $_.Value } | Sort-Object -Unique
$dlls

Write-Output "=== 3. hardcoded dev paths inside exe ==="
foreach ($pat in @("C:/dev", "C:\\dev", "C:\\Jellypal", "dev\\assets")) {
  $hit = $txt.Contains($pat)
  Write-Output ("{0} -> {1}" -f $pat, $hit)
}

Write-Output "=== 4. NSIS webview install mode (conf) ==="
Get-Content C:\dev\mini\typet\src-tauri\tauri.conf.json | Select-String "webview|nsis|installMode"

Write-Output "=== 5. WebView2 runtime present here ==="
$wv = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if ($wv) { Write-Output ("WebView2 Runtime: " + $wv.pv) } else { Write-Output "WebView2 runtime key not found" }
