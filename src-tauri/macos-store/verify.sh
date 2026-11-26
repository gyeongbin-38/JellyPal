#!/bin/bash
# Read-only checks for an unsigned or signed macOS store candidate.
set -euo pipefail
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ "$(uname -s)" == Darwin ]] || fail "Bundle verification requires macOS tools."
APP="${1:?path to Jellypal.app}"
PLIST="$APP/Contents/Info.plist"
PB=/usr/libexec/PlistBuddy
[[ -f "$PLIST" ]] || fail "Info.plist is missing."
plutil -lint "$PLIST" "$APP/Contents/Resources/PrivacyInfo.xcprivacy"
[[ "$($PB -c 'Print :CFBundleIdentifier' "$PLIST")" == com.jellypal.store ]] || fail "Incorrect bundle ID."
[[ "$($PB -c 'Print :LSMinimumSystemVersion' "$PLIST")" == 12.0 ]] || fail "Unexpected minimum macOS version."
[[ "$($PB -c 'Print :NSHighResolutionCapable' "$PLIST")" == true ]] || fail "Retina rendering is not enabled."
BIN="$APP/Contents/MacOS/$($PB -c 'Print :CFBundleExecutable' "$PLIST")"
[[ -f "$BIN" ]] || fail "Main executable is missing."
lipo "$BIN" -verify_arch x86_64 arm64
[[ -z "$(find "$APP" -iname '*.dll' -print -quit)" ]] || fail "Windows-only DLL found in Mac bundle."
echo "Store candidate verified: com.jellypal.store, macOS 12+, arm64 + x86_64, Retina, privacy manifest."
