Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$out = "$PSScriptRoot\_shots"
$vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $vs.Width, $vs.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($vs.Left, $vs.Top, 0, 0, $bmp.Size, [System.Drawing.CopyPixelOperation]::CaptureBlt)
$bmp.Save("$out\blt.png")
$g.Dispose(); $bmp.Dispose()
"saved blt.png"
