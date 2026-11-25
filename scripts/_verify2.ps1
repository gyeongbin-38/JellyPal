$dbg = Join-Path $env:APPDATA "com.jellypal.app\clickdbg.json"
Start-Sleep -Seconds 2
Write-Output ("clickdbg: " + (Get-Content $dbg -Raw))
$src = @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class W5 {
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
      var t = new StringBuilder(256); GetWindowTextW(h, t, 256);
      bool vis = IsWindowVisible(h);
      if (vis) sb2.AppendLine(string.Format("hwnd=0x{0:X} title='{1}' ex=0x{2:X8} TOOL={3} APP={4}",
        h.ToInt64(), t.ToString(), ex, (ex & 0x80) != 0, (ex & 0x40000) != 0));
      return true;
    }, IntPtr.Zero);
    return sb2.ToString();
  }
}
"@
Add-Type -TypeDefinition $src
$p = Get-Process jellypal -ErrorAction SilentlyContinue
Write-Output ([W5]::Report([uint32]$p.Id))
