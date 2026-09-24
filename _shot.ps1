Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$out = "$PSScriptRoot\_shots"
New-Item -ItemType Directory -Force -Path $out | Out-Null

# primary screen bounds
$vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
$pri = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

# shot 1: bottom strip (taskbar area where slimes live)
$h = 260
$bmp = New-Object System.Drawing.Bitmap $pri.Width, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($pri.Left, $pri.Bottom - $h, 0, 0, $bmp.Size)
$bmp.Save("$out\taskbar.png")
$g.Dispose(); $bmp.Dispose()

# shot 2: full screen
$bmp2 = New-Object System.Drawing.Bitmap $pri.Width, $pri.Height
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.CopyFromScreen($pri.Left, $pri.Top, 0, 0, $bmp2.Size)
$bmp2.Save("$out\full.png")
$g2.Dispose(); $bmp2.Dispose()

"saved: $out\taskbar.png, $out\full.png"
