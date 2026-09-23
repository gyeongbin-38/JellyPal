$wry = "C:\Users\박남표\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\wry-0.55.1"
Get-ChildItem "$wry\src" -Recurse -Filter "*.rs" | Select-String -Pattern "Failed|failed" -List | ForEach-Object { "$($_.Filename)" }
"--- webview2 file ---"
Get-ChildItem "$wry\src" -Recurse -Filter "*.rs" | Where-Object Name -match "webview2|wkv" | ForEach-Object { $_.FullName }
