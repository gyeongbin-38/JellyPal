Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("$PSScriptRoot\_shots\virtual.png")
# crop top 140px strip, upscale 2x for visibility
$h = 140
$bmp = New-Object System.Drawing.Bitmap ($src.Width), $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0,0,$src.Width,$h), (New-Object System.Drawing.Rectangle 0,0,$src.Width,$h), [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save("$PSScriptRoot\_shots\top.png")
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
"saved top.png"
