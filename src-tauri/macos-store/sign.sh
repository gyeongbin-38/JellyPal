#!/bin/bash
# Sign a Universal macOS App Store candidate. Does not upload or submit it.
# Usage: bash sign.sh APP APP_CERT INSTALLER_CERT BUILD_NUMBER PROFILE
set -euo pipefail

fail() { echo "ERROR: $*" >&2; exit 1; }
[[ "$(uname -s)" == Darwin ]] || fail "Run signing on a Mac."
APP="${1:?path to Jellypal.app}"
APP_CERT="${2:?Apple Distribution certificate identity}"
INSTALLER_CERT="${3:?Mac Installer Distribution certificate identity}"
BUILD="${4:?monotonically increasing build number}"
PROFILE="${5:?Mac App Store Connect distribution provisioning profile}"
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$APP/Contents/Info.plist"
PB=/usr/libexec/PlistBuddy

[[ "$BUILD" =~ ^[1-9][0-9]{0,3}(\.[0-9]{1,2}){0,2}$ ]] || fail "Use a valid CFBundleVersion, e.g. 127 or 1.27.0."
[[ -f "$PLIST" && -f "$PROFILE" ]] || fail "App bundle or provisioning profile is missing."
[[ "$($PB -c 'Print :CFBundleIdentifier' "$PLIST")" == com.jellypal.store ]] || fail "Refusing to sign a non-store bundle."
bash "$DIR/verify.sh" "$APP"

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jellypal-sign.XXXXXX")"
trap 'rm -rf "$TEMP_DIR"' EXIT
security cms -D -i "$PROFILE" > "$TEMP_DIR/profile.plist"
TEAM_ID="$($PB -c 'Print :TeamIdentifier:0' "$TEMP_DIR/profile.plist")"
APP_ID="$($PB -c 'Print :Entitlements:com.apple.application-identifier' "$TEMP_DIR/profile.plist")"
[[ "${APP_ID#*.}" == com.jellypal.store ]] || fail "Provisioning profile does not match com.jellypal.store."
[[ "$($PB -c 'Print :Entitlements:com.apple.security.get-task-allow' "$TEMP_DIR/profile.plist" 2>/dev/null || true)" != true ]] || fail "Use a distribution profile, not a development profile."
if $PB -c 'Print :ProvisionedDevices' "$TEMP_DIR/profile.plist" >/dev/null 2>&1; then
  fail "Use a Mac App Store Connect distribution profile without a device list."
fi
[[ "$($PB -c 'Print :ProvisionsAllDevices' "$TEMP_DIR/profile.plist" 2>/dev/null || true)" != true ]] || fail "Developer ID profiles cannot be submitted to the Mac App Store."

# Add the actual identity only while signing. Older App ID prefixes can differ
# from the Team ID, so use the identifier from the provisioning profile.
cp "$DIR/entitlements.plist" "$TEMP_DIR/entitlements.plist"
$PB -c "Add :com.apple.application-identifier string $APP_ID" "$TEMP_DIR/entitlements.plist"
$PB -c "Add :com.apple.developer.team-identifier string $TEAM_ID" "$TEMP_DIR/entitlements.plist"
cp "$PROFILE" "$APP/Contents/embedded.provisionprofile"
$PB -c "Set :CFBundleVersion $BUILD" "$PLIST"
codesign --force --sign "$APP_CERT" --entitlements "$TEMP_DIR/entitlements.plist" --timestamp "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
SIGNER_TEAM="$(codesign -dv --verbose=4 "$APP" 2>&1 | sed -n 's/^TeamIdentifier=//p')"
[[ "$SIGNER_TEAM" == "$TEAM_ID" ]] || fail "Signing certificate and profile belong to different teams."
codesign --display --entitlements - --xml "$APP" > "$TEMP_DIR/signed-entitlements.plist" 2>/dev/null
[[ "$($PB -c 'Print :com.apple.security.app-sandbox' "$TEMP_DIR/signed-entitlements.plist")" == true ]] || fail "Signed app is missing App Sandbox."
[[ "$($PB -c 'Print :com.apple.application-identifier' "$TEMP_DIR/signed-entitlements.plist")" == "$APP_ID" ]] || fail "Signed app identifier differs from the profile."

PKG="${APP%.app}.pkg"
productbuild --component "$APP" /Applications --sign "$INSTALLER_CERT" "$PKG"
pkgutil --check-signature "$PKG"
echo "Signed package: $PKG"
echo "Next: validate in Transporter before uploading to App Store Connect."
