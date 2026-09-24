$p = Get-Process -Name jellypal -ErrorAction SilentlyContinue
if (-not $p) { "NOT RUNNING"; exit }
$p | ForEach-Object {
  "pid=$($_.Id) title='$($_.MainWindowTitle)' handle=$($_.MainWindowHandle) mem=$([math]::Round($_.WorkingSet64/1MB))MB"
}
# topmost windows check via user32
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
$jpids = $p | ForEach-Object { $_.Id }
$cb = {
  param($h, $l)
  $procId = 0
  [W]::GetWindowThreadProcessId($h, [ref]$procId) | Out-Null
  if ($jpids -contains $procId) {
    $sb = New-Object System.Text.StringBuilder 256
    [W]::GetWindowText($h, $sb, 256) | Out-Null
    $r = New-Object W+RECT
    [W]::GetWindowRect($h, [ref]$r) | Out-Null
    "  hwnd=$h vis=$([W]::IsWindowVisible($h)) title='$($sb)' rect=$($r.Left),$($r.Top)-$($r.Right),$($r.Bottom)"
  }
  return $true
}
[W]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
