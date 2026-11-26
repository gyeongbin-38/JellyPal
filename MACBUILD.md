# Jellypal: Mac App Store build and verification

## Distribution and compatible devices

The store bundle ID is `com.jellypal.store`. In App Store Connect, select
**macOS only** when creating the app. Do not add iOS or visionOS platforms.
No iOS build is produced or submitted, so iPhone and iPad cannot install this
Mac app. The source also rejects iOS/Android compilation.

| Target | Release configuration | Verification status |
|---|---|---|
| Operating system | macOS 12.0 or newer | Current Mac CI passed; macOS 12 itself still needs testing |
| Apple silicon Mac | arm64 | Universal binary, sandbox launch and save verified on Mac CI |
| Intel Mac | x86_64 | Universal binary, sandbox launch and save verified on Mac CI |
| Hardware | MacBook Air/Pro, iMac, Mac mini, Mac Studio, Mac Pro meeting the OS/CPU requirements | This is not a claim of testing every model |
| iPhone, iPad, Apple Vision Pro | Excluded | Register only macOS in App Store Connect |

Login items use SMAppService on macOS 13+. The control is hidden on macOS 12.
The store app uses an opaque 480x560 logical-pixel companion window. On small
work areas it reduces its height and centers inside the menu-bar/Dock-safe
area. The transparent desktop-wide overlay belongs to the direct build.

## Local verification

Use Node.js 24, Rust stable and the platform's Tauri build prerequisites.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:layout
cd src-tauri
cargo check --locked
cargo test --locked --lib
```

For GNU Windows tools and a non-ASCII workspace path, the existing
`node scripts/_rustcheck.cjs` uses an ASCII target/temp directory. Native
Rust tests may need the same CARGO_TARGET_DIR and TEMP overrides.
On this GNU Windows host, the generated library-test executable also lacked
the Common Controls v6 manifest and failed to load TaskDialogIndirect.
All 10 native tests passed after adding that manifest to a temporary QA copy
of the executable and placing WebView2Loader.dll beside it. The source and
release binaries were not patched by this workaround. Mac CI subsequently
passed all native tests without this Windows-specific workaround.

Layout tests run the real src/main.js/styles.css and Canvas renderer in
Chromium with native IPC stubbed. Screenshots/results go to the temporary
`jellypal-store-layout` directory; set JELLYPAL_LAYOUT_OUTPUT to change it.
They do not verify native WKWebView, macOS window management, signing or live
StoreKit purchases. CI uploads them as the jellypal-layout artifact.

| Layout check | Conditions |
|---|---|
| Store card | 480x560, DPR 1 and 2 |
| Small work areas | 480x484 and 480x493, DPR 1 and 2 |
| Direct build | 1280x720, 1440x900, 1920x1080; DPR 1, 2, 1.5 |
| Interaction | Ranch close, status card, settings, last row of a large nursery |
| Position recovery | Saved position on a disconnected display; live viewport resize |
| Native placement calculation | Retina, negative display origins, small 800x600-class work area |

## Build on a Mac

Run in a separate clean checkout/worktree: prepare:store modifies Cargo.toml
and the base Tauri config. It does not modify player saves.

```sh
npm ci
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run prepare:store
npm run tauri build -- --config src-tauri/tauri.store.conf.json --features store --bundles app --target universal-apple-darwin
```

Output: `src-tauri/target/universal-apple-darwin/release/bundle/macos/Jellypal.app`

Preparation removes the private macOS API feature and Windows loader resource.
The store config enables App Sandbox, bundles the privacy manifest and sets
macOS 12.0 as the minimum OS. CI checks both CPU architectures with lipo and
stamps a unique CFBundleVersion. The CI artifact is an unsigned submission
candidate. Use `src-tauri/macos-store/sign.sh` on a Mac with the appropriate
distribution certificates to produce the installer package.

Signing requires the actual Mac App Store Connect distribution profile and
matching certificates. The signing helper embeds the profile and adds the
profile's application identifier and Team ID to the sandbox entitlements.
It validates the resulting app and installer signatures. It never uploads.

```sh
bash src-tauri/macos-store/sign.sh /path/Jellypal.app \
  "Apple Distribution: Your Name (TEAMID)" \
  "Mac Installer Distribution: Your Name (TEAMID)" \
  127 /path/Jellypal.provisionprofile
```

To inspect a downloaded candidate without signing:
`bash src-tauri/macos-store/verify.sh /path/Jellypal.app`.
The build workflow also accepts an optional `artifact_run_id` to download a
prior `jellypal-store` artifact and run it with ad-hoc App Sandbox signatures
on both Apple silicon and Intel CI hosts. This verifies packaging, launch and
save access and attempts a native desktop screenshot when the runner allows
screen capture. It does not replace StoreKit Sandbox or distribution signing.

The proposed App Store Connect app record, description and consumable product
IDs are in `src-tauri/macos-store/submission.json`. This is a draft; unset
owner fields must be completed in the Apple account before submission.

## Checks still required before upload

- Launch on macOS 12; verify login-item controls are hidden there.
- Test login items on macOS 13 or newer.
- Manually test menu-bar summon, window dragging, focus and quit on a Mac.
- Move between Retina and ordinary external displays; change display scaling
  and Dock location/auto-hide settings.
- Check the nursery with system scrollbars set to always visible.
- Test StoreKit Sandbox purchases, cancellation, failure and redelivery after
  force quitting, including a failed save before finishing payment.
- Verify certificates/provisioning requirements, the sandbox/privacy manifest
  and the final signed installer package.
- Confirm macOS-only App Store Connect platform, bundle ID, four IAP products,
  privacy and support URLs.
- Confirm submission screenshots represent the final Mac app. The existing
  stylized renders are exact-size opaque RGB assets validated by check-store,
  but final native Mac captures are preferable; Chromium QA captures are not
  native-device evidence.

## Verified candidate (2026-11-26)

- Version 0.4.4, build 116, bundle ID com.jellypal.store.
- [Universal build and launch passed](https://github.com/gyeongbin-38/JellyPal/actions/runs/45800537018).
- [Apple silicon and Intel sandbox launch/save passed](https://github.com/gyeongbin-38/JellyPal/actions/runs/45802249948).
- Both verification hosts produced native screenshots. No frontend errors
  appeared in their logs; the renderer heartbeat was present.
- The candidate is before Apple distribution signing. Ad-hoc signatures used
  for CI verification do not make it an upload-ready App Store package.
- Local candidate, native screenshots and logs:
  `dist/app-store-preflight-20261126/` (ignored build output).
- Archive SHA-256: `8e0a545bdc4bf101272c4cb990cc4bd3d4344ae20bcc2996e9431574ed4bae07`.

The owner can use a Mac later. Windows browser work can proceed with the
explicit App ID and macOS-only App Store Connect record while signing,
physical-device checks and StoreKit Sandbox testing wait for Mac access.
A local handoff bundle preserves the verified app archive, signing helpers,
submission draft, native screenshots, checksum and Korean instructions:
`dist/Jellypal_0.4.4_mac_handoff_20261126.zip`.
The inner app archive's SHA-256 was checked after ZIP packaging.

## Official references

- [Apple: create an app and select platforms](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
- [Apple: add platforms later](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms/)
- [Tauri: App Store distribution](https://v2.tauri.app/distribute/app-store/)
