$wry = "C:\Users\박남표\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\wry-0.55.1"
Get-ChildItem "$wry\src" | ForEach-Object { $_.Name }
"--- subdirs ---"
Get-ChildItem "$wry\src" -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
Get-ChildItem "$wry\src\webview2" -ErrorAction SilentlyContinue | ForEach-Object { "wv2: $($_.Name)" }
