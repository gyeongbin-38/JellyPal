$procs = Get-Process | Where-Object { $_.ProcessName -like "*jelly*" -or $_.ProcessName -like "*Jellypal*" }
if ($procs) {
  $procs | Format-Table Id, ProcessName, MainWindowTitle, Description, Responding -AutoSize | Out-String -Width 200
} else {
  Write-Output "NO JELLYPAL PROCESS RUNNING"
}
$vi = (Get-Item 'C:\Jellypal\jellypal.exe' -ErrorAction SilentlyContinue).VersionInfo
if ($vi) {
  Write-Output "exe FileDescription: $($vi.FileDescription)"
  Write-Output "exe ProductName: $($vi.ProductName)"
}
