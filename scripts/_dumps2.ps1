$cp = "$env:LOCALAPPDATA\com.jellypal.desktop\EBWebView\Crashpad"
Get-ChildItem "$cp\reports" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 8 | ForEach-Object { "$($_.Name)  $($_.Length)B  $($_.LastWriteTime)" }
"--- pending ---"
Get-ChildItem "$cp\pending" -ErrorAction SilentlyContinue | Select-Object -First 8 | ForEach-Object { "$($_.Name)  $($_.LastWriteTime)" }
"--- old app dir too ---"
$cp2 = "$env:LOCALAPPDATA\com.jellypal.app\EBWebView\Crashpad\reports"
Get-ChildItem $cp2 -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object { "$($_.Name)  $($_.LastWriteTime)" }
