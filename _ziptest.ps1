$ErrorActionPreference = "Continue"
$zip = "C:\dev\mini\typet\dist\jellypal-0.2.0-win.zip"
$dst = "C:\dev\ziptest"

"=== 1. zip contents ==="
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
$z.Entries | ForEach-Object { "  $($_.FullName)  $($_.Length)B" }
$z.Dispose()

"=== 2. extract + run ==="
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
Expand-Archive $zip -DestinationPath $dst
Get-ChildItem $dst -Recurse | ForEach-Object { "  $($_.FullName.Replace($dst,''))" }
$exe = Get-ChildItem $dst -Recurse -Filter *.exe | Select-Object -First 1
"exe: $($exe.FullName)"

"=== 3. launch portable ==="
$p0 = Get-Process jellypal -ErrorAction SilentlyContinue
"instances before: $($p0.Count)"
Start-Process $exe.FullName
Start-Sleep 10
$p = Get-Process jellypal -ErrorAction SilentlyContinue
"instances after: $($p.Count)"
$p | ForEach-Object { "  pid=$($_.Id) path=$($_.Path) responding=$($_.Responding)" }
