Add-Type -AssemblyName System.Windows.Forms
$mons = [System.Windows.Forms.Screen]::AllScreens
Write-Host ("monitor count: " + $mons.Count)
foreach ($m in $mons) {
  Write-Host ("  " + $m.DeviceName + " primary=" + $m.Primary + " bounds=" + $m.Bounds.ToString())
}
# DPI awareness + effective scale via registry (per-monitor)
$dc = Get-ItemProperty "HKCU:\Control Panel\Desktop" -Name LogPixels -ErrorAction SilentlyContinue
if ($dc) { Write-Host ("system DPI LogPixels=" + $dc.LogPixels + " (" + ($dc.LogPixels/96*100) + "%)") }
Get-ChildItem "HKCU:\Control Panel\Desktop\PerMonitorSettings" -ErrorAction SilentlyContinue | ForEach-Object {
  $v = Get-ItemProperty $_.PSPath
  Write-Host ("  per-monitor: " + $_.PSChildName + " DpiValue=" + $v.DpiValue)
}
