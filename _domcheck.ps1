$domains = @(
  @{ n = "jellypal.app";    rdap = "https://rdap.nic.google/domain/jellypal.app" },
  @{ n = "jellypal.dev";    rdap = "https://rdap.nic.google/domain/jellypal.dev" },
  @{ n = "jellypal.fun";    rdap = "https://rdap.identitydigital.services/rdap/domain/jellypal.fun" },
  @{ n = "jellypal.io";     rdap = "https://rdap.cscglobal.com/dbs/rdap-api/domain/jellypal.io" },
  @{ n = "jellypal.me";     rdap = "https://rdap.identitydigital.services/rdap/domain/jellypal.me" },
  @{ n = "jellypal.shop";   rdap = "https://rdap.identitydigital.services/rdap/domain/jellypal.shop" },
  @{ n = "jellypal.site";   rdap = "https://rdap.identitydigital.services/rdap/domain/jellypal.site" },
  @{ n = "getjellypal.com"; rdap = "https://rdap.verisign.com/com/v1/domain/getjellypal.com" },
  @{ n = "jellypal.net";    rdap = "https://rdap.verisign.com/net/v1/domain/jellypal.net" }
)
foreach ($d in $domains) {
  try {
    $r = Invoke-WebRequest -Uri $d.rdap -Method Head -TimeoutSec 10 -ErrorAction Stop
    "{0,-18} TAKEN (200)" -f $d.n
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -eq 404) { "{0,-18} AVAILABLE" -f $d.n }
    else { "{0,-18} ? ($code)" -f $d.n }
  }
}
