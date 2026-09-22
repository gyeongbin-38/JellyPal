$src = @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class W4 {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetWindowLongPtrW(IntPtr h, int idx);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  public delegate bool EnumProc(IntPtr h, IntPtr lp);
  public static string Report(uint target) {
    var sb2 = new StringBuilder();
    EnumWindows((h, lp) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid != target) return true;
      int ex = GetWindowLongPtrW(h, -20);
      int st = GetWindowLongPtrW(h, -16);
      var t = new StringBuilder(256); GetWindowTextW(h, t, 256);
      bool vis = IsWindowVisible(h);
      sb2.AppendLine(string.Format("hwnd=0x{0:X} vis={1} title='{2}' style=0x{3:X8} ex=0x{4:X8} TOOL={5} APP={6}",
        h.ToInt64(), vis, t.ToString(), st, ex, (ex & 0x80) != 0, (ex & 0x40000) != 0));
      return true;
    }, IntPtr.Zero);
    return sb2.ToString();
  }
}
"@
Add-Type -TypeDefinition $src
$p = Get-Process jellypal -ErrorAction SilentlyContinue
if (-not $p) { Write-Output "no process"; exit }
Write-Output ("PID=" + $p.Id)
Write-Output ([W4]::Report([uint32]$p.Id))
