# App Review Notes - Jellypal (macOS)

Jellypal is a local desktop companion for Mac. A slime lives in an opaque
companion window and collects jelly while the app is open. The submitted
platform is macOS only; there are no iPhone, iPad, or visionOS builds.

## What to test

- Launch the app: a 480x560 logical-pixel companion window appears. Its
  height fits the usable desktop on smaller displays.
- The slime animates and earns +3 jelly every five minutes while the app
  is open, with occasional lucky drops. No keyboard monitoring is needed.
- Click the slime to pet it; use the round menu button for the collection,
  toys and settings. Drag empty space to move the window.
- RANCH opens the collection, breeding and accessories. The separate
  NURSERY scrolls when its baby collection exceeds the window height.
- Settings > JELLY opens optional StoreKit consumable packs. The full game
  can be played without purchases. Prices come from the App Store.
- Settings > QUIT or the menu bar > Quit exits the app.

## Review details

- No account or sign-in is required for gameplay.
- The app does not monitor global keyboard input or request Accessibility,
  Input Monitoring or Screen Recording permissions.
- The store flavor does not initiate update, weather or analytics requests.
  StoreKit uses Apple's purchase services; these are not app telemetry.
- Digital goods use StoreKit only. External checkout links and redeem codes
  are hidden in this build.
- Purchase grants and stable transaction IDs are saved before transactions
  are finished. A failed save leaves the payment eligible for retry.
- App Sandbox is enabled. Saves and photos use the sandbox's app-data
  directory for com.jellypal.store. The privacy manifest is bundled.
- The opaque companion window uses public APIs. It stays above ordinary
  windows; it has no title bar or standard minimize button. Quit is available
  from Settings and the menu bar.
- macOS 12 or newer is required. Login-item controls are available on
  macOS 13 or newer and hidden on macOS 12.

## Submission evidence

The build, signing and device checks still needed before upload are recorded
in MACBUILD.md. Final submission screenshots must be captured from the final
Mac app; existing stylized marketing renders and Chromium QA captures are
not evidence of native macOS testing.
