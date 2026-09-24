foreach ($u in @("https://jellypal.fun/","https://jellypal.fun/pals.js","https://jellypal.fun/ranch.js","https://jellypal.fun/dl/Jellypal_0.2.0_x64-setup.exe")) {
  $r = curl.exe -s -o NUL -w "%{http_code} %{size_download}" -I $u
  "$u -> $r"
}
