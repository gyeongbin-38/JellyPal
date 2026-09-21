Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Select-Object ProcessId, ParentProcessId, CommandLine |
  Format-List |
  Out-File -Encoding utf8 C:\dev\mini\typet\_nodeprocs.txt
