param([int]$Pid2 = 0)
$ErrorActionPreference = "Continue"
if ($Pid2 -eq 0) {
  $p = Get-Process jellypal -ErrorAction SilentlyContinue | Select-Object -First 1
} else {
  $p = Get-Process -Id $Pid2 -ErrorAction SilentlyContinue
}
if (-not $p) { "no jellypal process"; exit }
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class R {
  [DllImport("user32.dll")] public static extern int GetGuiResources(IntPtr hProcess, int uiFlags);
}
"@
$gdi = [R]::GetGuiResources($p.Handle, 0)
$usr = [R]::GetGuiResources($p.Handle, 1)
"pid=$($p.Id)"
"WS_MB={0:N1} private_MB={1:N1} handles={2} threads={3} gdi={4} user={5}" -f ($p.WorkingSet64/1MB),($p.PrivateMemorySize64/1MB),$p.HandleCount,$p.Threads.Count,$gdi,$usr
# child processes (WebView2 spawns renderers)
Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'jellypal' -or $_.ParentProcessId -eq $p.Id } |
  ForEach-Object { "  wv2 pid=$($_.ProcessId) parent=$($_.ParentProcessId)" }
Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" -ErrorAction SilentlyContinue |
  Measure-Object WorkingSetSize -Sum | ForEach-Object { "  all-webview2 total MB: {0:N0} count-less-metric" -f ($_.Sum/1MB) }
