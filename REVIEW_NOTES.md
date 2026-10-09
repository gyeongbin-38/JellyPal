# App Review Notes — JellyPal

JellyPal is a small pixel-art desktop companion. A slime lives in a card on
your desktop and quietly collects "jelly" while you work.

## What to test

- Launch the app — a rounded companion card appears on the desktop.
- The slime animates and earns **+3 jelly every 5 minutes** while the app is
  open (occasionally a rare +30 "lucky drop"). No user input is required.
- Click the slime to pet it; click the round "+" button to open the menu.
- **RANCH** opens the collection panel: a gacha machine (jelly-funded),
  species Dex, breeding, and accessories.
- **JELLY** row in Settings opens the in-app purchase panel (StoreKit
  consumables: jelly packs in four sizes). Optional; the full game is free.
- Drag the card by any empty area to move it. Click the card's ✕ or press
  Cmd-Q to quit.

## Review-specific details

- **No sign-in required.** The full game is free and local.
- **No global monitoring of any kind.** The app does not read keyboard
  input, does not use event taps, and does not request Accessibility or
  Input Monitoring permission. Presence is detected by ordinary mouse
  events delivered to the app's own window.
- **No network requests.** This build makes zero outbound connections —
  no update checks, no analytics, no telemetry.
- **In-app purchases** are StoreKit consumables (jelly packs) sold via
  `iap_buy`. Digital goods are not purchasable through any external
  channel in this build.
- **Sandbox** entitlement is enabled; the app writes only inside its
  container (`~/Library/Application Support/com.jellypal.store` via the
  app-data directory APIs).
- Window behavior: the companion card is a normal titled-less window the
  user can drag and minimize; it does not overlay other apps'
  windows invisibly and does not use private APIs.

## Screenshots

`assets/store-shot*.png` — generated from the app's own renderer at
1280x800 and 2560x1600 (both App Store Connect sizes), showing the card
over a desktop, the Ranch collection panel, and a rare pull.
