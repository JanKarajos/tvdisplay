#!/usr/bin/env bash
# Otvorí displej TV Display v Chromiu na celej obrazovke (kiosk režim).
# Spúšťa sa automaticky po prihlásení (nastaví orangepi/install.sh).
PORT="${PORT:-8080}"
URL="http://localhost:${PORT}/#display"

# Vypni šetrič obrazovky a uspávanie monitora
xset s off 2>/dev/null
xset s noblank 2>/dev/null
xset -dpms 2>/dev/null

# Skry kurzor myši, keď sa nehýbe
command -v unclutter >/dev/null && unclutter -idle 1 -root &

# Počkaj, kým sa spustí server
for _ in $(seq 1 60); do
  curl -sf "http://localhost:${PORT}/api/state" >/dev/null && break
  sleep 1
done

BROWSER="$(command -v chromium || command -v chromium-browser)"
PROFILE_DIR="${HOME}/.config/tvdisplay-kiosk"
mkdir -p "$PROFILE_DIR"
# Po neštandardnom vypnutí (vytiahnutie napájania) nechceme lištu "Obnoviť stránky?"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
  "${PROFILE_DIR}/Default/Preferences" 2>/dev/null

exec "$BROWSER" \
  --user-data-dir="$PROFILE_DIR" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --password-store=basic \
  --check-for-update-interval=31536000 \
  "$URL"
