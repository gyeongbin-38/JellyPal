gh run view --job 106828006614 --log 2>&1 | Select-String -Pattern "bundle/|\.dmg|\.app|warning.*bundle|Finished" | Select-Object -First 20 | ForEach-Object { $_.Line }
