$exe = "C:\dev\mini\typet\src-tauri\target\release\jellypal.exe"
$bytes = [System.IO.File]::ReadAllBytes($exe)
$hit = $false
foreach ($s in @("api.jellypal.fun","workers.dev")) {
  $b = [System.Text.Encoding]::ASCII.GetBytes($s)
  $found = $false
  for ($i = 0; $i -lt $bytes.Length - $b.Length; $i++) {
    $m = $true
    for ($j = 0; $j -lt $b.Length; $j++) { if ($bytes[$i+$j] -ne $b[$j]) { $m = $false; break } }
    if ($m) { $found = $true; break }
  }
  "embedded ${s}: $found"
}
Copy-Item $exe "C:\Jellypal\jellypal.exe" -Force
"installed copy updated"
