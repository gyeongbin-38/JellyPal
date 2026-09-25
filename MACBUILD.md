# JellyPal — macOS build & test

## 1. Toolchain

```bash
xcode-select --install                       # clang + headers
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node gh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # pick default
```

## 2. Get the code + build

```bash
gh auth login                                # repo is private
gh repo clone gyeongbin-38/JellyPal
cd JellyPal
npm ci
npm run tauri build -- --bundles app         # add 'dmg' to also get an installer image
```

Binary lands at:
`src-tauri/target/release/bundle/macos/Jellypal.app`

Dev loop instead: `npm run tauri dev` (recompiles on save).

## 3. First run — the one permission that matters

Launch the .app. macOS will ask for **Input Monitoring**
(System Settings → Privacy & Security → Input Monitoring → enable Jellypal).

- WITHOUT it: app still runs, slimes still walk — but the **typing-rewards
  loop is dead** (rdev can't see global keystrokes, `hook.log` records the
  failure) and global mouse-button tracking is off.
- Running via `tauri dev`? The permission prompt targets the dev binary /
  your terminal instead — same toggle, same effect.

Screen Recording is NOT required (window-top perching uses CGWindowList,
which needs no permission; window titles just come back empty).

Gatekeeper doesn't apply to locally-built apps — it runs straight away.

## 4. What "correct" looks like

- Transparent overlay, **no Dock icon** (by design — Accessory policy),
  menu-bar tray icon with Summon/Quit
- slimes walk along the bottom and perch on window top edges
- hovering a slime makes it grabbable (click-through flips off);
  clicking desktop passes through
- typing anywhere earns jelly
- Settings gear → RESET → SURE? → second tap wipes saves and relaunches
  into true first-run (sprout only, 100 jelly + first-day bonuses)

## 5. Diagnostics (same files as Windows)

```
~/Library/Application Support/com.jellypal.desktop/
  clickdbg.json   # inside / rects / cursor / dragging / flipfail — 1s poll
  crash.log       # JS errors + 20s heartbeat "tick"
  hook.log        # written ONLY if rdev listen failed (permission!)
  state.json      # the save
```

Watch live: `watch -n1 'cat "$HOME/Library/Application Support/com.jellypal.desktop/clickdbg.json"'`

- `flipfail` climbing → set_ignore_cursor_events calls failing (report it)
- `rects` stuck at 0 past ~10s → frontend never sent clickable regions
- `hook.log` exists → Input Monitoring permission missing

## 6. Automated smoke test

```bash
bash _qa_mac.sh
```

Backs up every save (incl. legacy identifier dirs), cold-launches the
binary, samples clickdbg for 20s, prints first-run state, checks for
legacy-save resurrection, then restores your real save.

## 7. Known macOS limits (not bugs)

- Overlay won't float over **fullscreen Spaces** — that's an NSWindow
  level restriction; it appears again on normal desktops.
- Overlay covers the **primary display** only.
- `active-win-pos-rs` window titles are empty without Screen Recording —
  foreground-app detection still works via the process/app name.
