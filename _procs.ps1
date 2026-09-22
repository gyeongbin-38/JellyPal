Get-Process | Where-Object { $_.Name -match 'cargo|rustc|link|jellypal' } |
    Select-Object Id, Name, CPU | Format-Table -AutoSize
