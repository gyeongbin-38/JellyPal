$ErrorActionPreference = "Continue"
$zipExe = "C:\dev\ziptest\jellypal.exe"
$relExe = "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe"
$insExe = "C:\dev\mini\typet\src-tauri\target\release\bundle\nsis\Jellypal_0.2.0_x64-setup.exe"
foreach ($f in @($zipExe,$relExe,$insExe)) {
  if (Test-Path $f) {
    $h = (Get-FileHash $f -Algorithm SHA256).Hash.Substring(0,16)
    "{0}  {1}B  {2}  {3}" -f $h,(Get-Item $f).Length,(Get-Item $f).LastWriteTime,$f
  } else { "MISSING: $f" }
}
