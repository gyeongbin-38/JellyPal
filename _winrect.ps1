Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class W2 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int idx);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
$p = Get-Process -Name jellypal -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $p) { "NOT RUNNING"; exit }
$h = $p.MainWindowHandle
"pid=$($p.Id) hwnd=$h"
$r = New-Object W2+RECT
[W2]::GetWindowRect($h, [ref]$r) | Out-Null
"rect: $($r.Left),$($r.Top) -> $($r.Right),$($r.Bottom)  size=$($r.Right-$r.Left)x$($r.Bottom-$r.Top)"
"visible: $([W2]::IsWindowVisible($h))"
$ex = [W2]::GetWindowLong($h, -20)  # GWL_EXSTYLE
"exstyle: 0x{0:X8} (topmost=0x8 layered=0x80000 transparent=0x20)" -f $ex
"topmost: " + [bool]($ex -band 0x8)
"layered: " + [bool]($ex -band 0x80000)
"clickthrough: " + [bool]($ex -band 0x20)
