$wry = Get-ChildItem "$env:USERPROFILE\.cargo\registry\src" -Recurse -Directory -Filter "wry-*" | Select-Object -First 1
"wry dir: $($wry.FullName)"
Get-ChildItem $wry.FullName -Recurse -Filter "*.rs" | Measure-Object | ForEach-Object { "rs files: $($_.Count)" }
Get-ChildItem $wry.FullName -Recurse -Filter "*.rs" | Select-String -Pattern "ProcessFailed|BrowserProcessExited|RenderProcess" | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim().Substring(0,[Math]::Min(90,$_.Line.Trim().Length)))" }
