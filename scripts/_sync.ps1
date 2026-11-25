$files = @(
  "src\main.js",
  "src-tauri\Cargo.toml",
  "src-tauri\tauri.conf.json",
  "src-tauri\Cargo.lock",
  "README.txt",
  "site\index.html",
  "site\version.txt"
)
foreach ($f in $files) {
  Copy-Item -Force "C:\dev\mini\typet\$f" "C:\build\typet\$f"
  Write-Output ("copied " + $f)
}
Write-Output ("staged ver: " + (Select-String -Path "C:\build\typet\src-tauri\Cargo.toml" -Pattern '^version').Line)
