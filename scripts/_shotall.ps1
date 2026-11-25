Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$out = "$PSScriptRoot\_shots"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
"virtual screen: $($vs.Left),$($vs.Top) $($vs.Width)x$($vs.Height)"

$bmp = New-Object System.Drawing.Bitmap $vs.Width, $vs.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($vs.Left, $vs.Top, 0, 0, $bmp.Size)
$bmp.Save("$out\virtual.png")
$g.Dispose(); $bmp.Dispose()
"saved: $out\virtual.png"

# per-screen info
foreach ($s in [System.Windows.Forms.Screen]::AllScreens) {
  "screen: $($s.DeviceName) bounds=$($s.Bounds) primary=$($s.Primary)"
}
