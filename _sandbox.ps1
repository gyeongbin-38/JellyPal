"sandbox exe: $(Test-Path C:\Windows\System32\WindowsSandbox.exe)"
$f = Get-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -ErrorAction SilentlyContinue
"feature state: $($f.State)"
"vtx: $((Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled)"
