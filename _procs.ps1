"jellypal:"; Get-Process jellypal -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.Id) $($_.Path)" }
"cargo/rustc:"; Get-Process cargo,rustc -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.Name) $($_.Id)" }
"link:"; Get-Process link,ld,lld-link -ErrorAction SilentlyContinue | ForEach-Object { "  $($_.Name) $($_.Id)" }
