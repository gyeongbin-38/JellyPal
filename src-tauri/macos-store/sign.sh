#!/bin/bash
# sign_store.sh — sign + package Jellypal.app for the Mac App Store.
#
# Run on a Mac with an Apple Developer Program membership and the two
# certificates installed in the login keychain:
#   "Apple Distribution: <Name> (<TEAMID>)"        (application)
#   "3rd Party Mac Developer Installer: <Name> (<TEAMID>)"  (installer)
#
# usage:
#   ./sign.sh <path-to-Jellypal.app> "<app cert>" "<installer cert>" [build-number]
#
# example:
#   ./sign.sh Jellypal.app \
#     "Apple Distribution: Gildong Hong (ABCDE12345)" \
#     "3rd Party Mac Developer Installer: Gildong Hong (ABCDE12345)" 42
#
# Produces Jellypal.pkg next to the .app — upload it with Transporter
# (open -a Transporter Jellypal.pkg) or: xcrun altool --upload-app ...
set -euo pipefail

APP="${1:?path to Jellypal.app}"
APP_CERT="${2:?Apple Distribution cert name}"
INSTALLER_CERT="${3:?installer cert name}"
BUILD="${4:-$(date +%Y%m%d%H%M)}"
DIR="$(cd "$(dirname "$0")" && pwd)"

# App Store wants a monotonically increasing CFBundleVersion per upload.
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD" "$APP/Contents/Info.plist" \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string $BUILD" "$APP/Contents/Info.plist"

# privacy manifest must sit in Contents/Resources — warn early if missing.
[ -f "$APP/Contents/Resources/PrivacyInfo.xcprivacy" ] \
  || { echo "WARN: Resources/PrivacyInfo.xcprivacy missing"; }

codesign --force --sign "$APP_CERT" \
  --entitlements "$DIR/entitlements.plist" \
  --timestamp "$APP"

echo "== signature =="
codesign -d --entitlements :- "$APP" 2>/dev/null || true
codesign --verify --deep --strict --verbose=2 "$APP"

PKG="${APP%.app}.pkg"
productbuild --component "$APP" /Applications --sign "$INSTALLER_CERT" "$PKG"
echo "== built $PKG =="
echo "next: open -a Transporter '$PKG'  (or xcrun altool --upload-app -f '$PKG' -t macos -u <apple-id>)"
