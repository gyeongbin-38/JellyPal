# upload fresh assets to the v0.2.0 release, then verify hashes
Set-Location C:\dev\mini\typet
gh release upload v0.2.0 dist\jellypal-0.2.0-win.zip dist\Jellypal_0.2.0_x64-setup.exe --clobber
Write-Output "--- remote hashes ---"
gh release view v0.2.0 --json assets --jq ".assets[] | {name, size, digest}"
