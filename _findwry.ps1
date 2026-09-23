$wry = Get-ChildItem "$env:USERPROFILE\.cargo\registry\src" -Recurse -Directory -Filter "wry-*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $wry) { $wry = Get-ChildItem "C:\cargo2\registry\src" -Recurse -Directory -Filter "wry-*" -ErrorAction SilentlyContinue | Select-Object -First 1 }
"wry: $($wry.FullName)"
if ($wry) {
  Get-ChildItem "$($wry.FullName)\src" -Recurse -Filter "*.rs" -ErrorAction SilentlyContinue |
    Select-String -Pattern "ProcessFailed|process_failed|COREWEBVIEW2_PROCESS_FAILED" -List |
    ForEach-Object { "$($_.Filename): $($_.LineNumber)" }
}
