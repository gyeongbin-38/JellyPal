# Build helper for this machine: tauri_build canonicalizes the repo-relative
# icon path into the real (Korean-named) directory, which GNU windres cannot
# read ("Illegal byte sequence"). The committed config keeps the portable
# repo-relative path; local builds override just the icon via TAURI_CONFIG
# pointing at an ASCII mirror of the same file.
Copy-Item -Force "C:\dev\mini\typet\src-tauri\icons\icon.ico" "C:\Jellypal\icon.ico"
$env:TAURI_CONFIG = '{"bundle":{"icon":["C:/Jellypal/icon.ico"]}}'
# strip local source paths out of panic messages in the shipped binary
$env:RUSTFLAGS = "--remap-path-prefix=C:\dev\mini\typet=jellypal --remap-path-prefix=C:\cargo2\registry\src=crates"
Set-Location "C:\dev\mini\typet\src-tauri"
cargo build --release
exit $LASTEXITCODE
