Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead("C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip")
$e = $z.Entries | Where-Object { $_.Name -eq "jellypal.exe" }
$ms = New-Object IO.MemoryStream
$s = $e.Open(); $s.CopyTo($ms); $s.Close()
$ms.Position = 0
$zh = (Get-FileHash -Algorithm SHA256 -InputStream $ms).Hash
$z.Dispose()
$th = (Get-FileHash "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe").Hash
Write-Output ("zip: " + $zh)
Write-Output ("exe: " + $th)
Write-Output ("MATCH: " + ($zh -eq $th))
