#!/bin/bash
# Zostaví jeden samorozbaľovací inštalátor pre Orange Pi PC: dist-orangepi/tvdisplay-orangepi-install.sh
# Aplikácia sa zostaví tu, na zariadení sa nič nekompiluje. Súbor .env (token, PIN) sa nepribaľuje.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT/dist-orangepi"
OUT="$OUT_DIR/tvdisplay-orangepi-install.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "==> Zostavujem aplikáciu"
rsync -a --exclude node_modules --exclude .git --exclude dist --exclude dist-orangepi \
  --exclude archiv --exclude uploads --exclude .env --exclude '*.tar.gz' "$ROOT/" "$WORK/src/"
(cd "$WORK/src" && npm ci --no-audit --no-fund --silent && npx vite build --logLevel warn)

echo "==> Pripravujem balík"
STAGE="$WORK/stage"
mkdir -p "$STAGE"
cp -R "$WORK/src/dist" "$WORK/src/server" "$WORK/src/Texty" "$WORK/src/songs.json" "$WORK/src/images.json" "$STAGE/"

# Iba knižnice servera, v presných verziách z package-lock.json. Bez voliteľných natívnych balíkov
# je node_modules nezávislé od procesora, takže sa dá zostaviť tu a spustiť na ARM.
node -e '
  const fs = require("fs");
  const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const names = ["cors", "dotenv", "express", "pdfjs-dist", "ws"];
  const dependencies = Object.fromEntries(names.map((n) => [n, lock.packages[`node_modules/${n}`].version]));
  fs.writeFileSync(process.argv[2], JSON.stringify({ name: "songdisplay", private: true, type: "module", dependencies }, null, 2));
' "$WORK/src/package-lock.json" "$STAGE/package.json"
(cd "$STAGE" && npm install --omit=optional --omit=dev --no-audit --no-fund --no-package-lock --silent)

# pdfjs-dist je veľký, server z neho potrebuje iba počítanie strán
PDFJS="$STAGE/node_modules/pdfjs-dist"
find "$PDFJS" -mindepth 1 -maxdepth 1 ! -name legacy ! -name package.json ! -name LICENSE -exec rm -rf {} +
find "$PDFJS/legacy" -mindepth 1 -maxdepth 1 ! -name build -exec rm -rf {} +
find "$PDFJS/legacy/build" -type f ! -name pdf.mjs ! -name pdf.worker.mjs -delete

echo "==> Skladám inštalátor"
TAR_FLAGS=()
tar --version | grep -q bsdtar && TAR_FLAGS=(--no-xattrs --no-mac-metadata)
COPYFILE_DISABLE=1 tar czf "$WORK/payload.tgz" "${TAR_FLAGS[@]}" -C "$STAGE" .

mkdir -p "$OUT_DIR"
cat "$ROOT/deploy/orangepi/install.sh" "$WORK/payload.tgz" >"$OUT"
chmod +x "$OUT"
echo "Hotovo: $OUT ($(du -h "$OUT" | cut -f1))"
