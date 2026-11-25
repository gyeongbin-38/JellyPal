Set-Location 'C:\dev\mini\typet'
foreach ($t in @('scripts/_socsim.cjs','scripts/_eatsim.cjs','scripts/_fresh.cjs','scripts/_cleantest.cjs')) {
  Write-Output "--- $t"
  node $t | Select-Object -Last 6
}
