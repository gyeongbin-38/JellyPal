!macro NSIS_HOOK_POSTUNINSTALL
  ; drop the save-checkpoint watermark so a reinstalled app can adopt a
  ; restored backup instead of rejecting it as a rollback
  DeleteRegKey HKCU "Software\JellyPal"
!macroend
