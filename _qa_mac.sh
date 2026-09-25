#!/bin/bash
# QA harness for the macOS build — same checks as the Windows _qa.cjs:
# 1) back up all save files, 2) launch the built binary, 3) sample clickdbg,
# 4) verify true first-run state, 5) restore saves.
# Usage: bash _qa_mac.sh

APP="src-tauri/target/release/bundle/macos/Jellypal.app/Contents/MacOS/jellypal"
DATA="$HOME/Library/Application Support/com.jellypal.desktop"
LEGACY1="$HOME/Library/Application Support/com.jellypal.app"
LEGACY2="$HOME/Library/Application Support/com.typet.app"
STATE="$DATA/state.json"
DBG="$DATA/clickdbg.json"

echo "[qa] killing running jellypal..."
pkill -f "jellypal" 2>/dev/null
sleep 1

echo "[qa] backing up saves..."
MOVED=()
for d in "$DATA" "$LEGACY1" "$LEGACY2"; do
  for n in state.json state.json.bak; do
    f="$d/$n"
    if [ -f "$f" ]; then
      mv "$f" "$f.qa-backup"
      MOVED+=("$f")
      echo "  backed up $f"
    fi
  done
done
rm -f "$DBG"

if [ ! -f "$APP" ]; then
  echo "[qa] MISSING $APP — run: npx tauri build --bundles app"
  for f in "${MOVED[@]}"; do mv "$f.qa-backup" "$f"; done
  exit 1
fi

echo "[qa] launching..."
"$APP" &
APP_PID=$!

echo "[qa] sampling clickdbg (webview takes ~5-10s)..."
for i in $(seq 1 10); do
  sleep 2
  if [ -f "$DBG" ]; then
    echo "  t=$((i*2))s $(cat "$DBG")"
  else
    echo "  t=$((i*2))s no clickdbg yet"
  fi
done

if [ -f "$STATE" ]; then
  echo "[qa] fresh state:"
  cat "$STATE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(' jelly:',d.get('jelly'),'pals:',len(d.get('pals',[])),'props placed:',sum(1 for v in (d.get('props') or {}).values() if v),'owned:',d.get('owned'),'seen:',d.get('seen'))"
  JELLY=$(cat "$STATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('jelly',-1))")
  PALS=$(cat "$STATE" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('pals',[])))")
  PROPS=$(cat "$STATE" | python3 -c "import json,sys; print(sum(1 for v in (json.load(sys.stdin).get('props') or {}).values() if v))")
  if [ "$PALS" = "0" ] && [ "$PROPS" = "0" ]; then
    echo "[qa] FIRST-RUN: PASS (jelly=$JELLY — 100 base + first-day bonuses is expected)"
  else
    echo "[qa] FIRST-RUN: FAIL"
  fi
else
  echo "[qa] WARN: no state.json written"
fi

for d in "$LEGACY1" "$LEGACY2"; do
  if [ -f "$d/state.json" ]; then
    echo "[qa] $d/state.json: EXISTS (migration fired)"
  else
    echo "[qa] $d/state.json: absent"
  fi
done

echo "[qa] crash.log tail:"
tail -5 "$DATA/crash.log" 2>/dev/null || echo "  (absent — clean)"
echo "[qa] hook.log:"
cat "$DATA/hook.log" 2>/dev/null || echo "  (absent — rdev OK)"

kill $APP_PID 2>/dev/null
sleep 1
pkill -f "jellypal" 2>/dev/null

echo "[qa] restoring saves..."
for f in "${MOVED[@]}"; do
  rm -f "$f"
  mv "$f.qa-backup" "$f"
  echo "  restored $f"
done
echo "[qa] done."
