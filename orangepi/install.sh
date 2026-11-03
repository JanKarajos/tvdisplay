#!/usr/bin/env bash
# Inštalácia TV Display na Orange Pi PC (Armbian / Debian s grafickým prostredím).
#
# Použitie (ako bežný používateľ, nie root):
#   git clone https://github.com/JanKarajos/tvdisplay.git
#   cd tvdisplay
#   ./orangepi/install.sh
#
# Čo skript urobí:
#   1. nainštaluje Chromium, Node.js 22 a pomocné balíčky
#   2. zbuilduje aplikáciu (npm ci + npm run build)
#   3. opýta sa na adresu dát kostola z administrácie (NAS)
#   4. vytvorí systemd službu "tvdisplay", ktorá spustí server po štarte
#   5. nastaví automatické otvorenie displeja na celej obrazovke po prihlásení
#
# Adresu dát kostola nájdeš v administrácii v záložke Kostoly ("Adresa pre Orange Pi").
# Dá sa zadať aj vopred: TVDISPLAY_DATA_URL=https://... ./orangepi/install.sh
# Zmena adresy neskôr: TVDISPLAY_DATA_URL=https://... ./orangepi/install.sh
#
# Skript sa dá spustiť znova - napr. po "git pull" na aktualizáciu aplikácie.
set -euo pipefail

PORT="${PORT:-8080}"
NODE_MAJOR=22
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="$(id -un)"
APP_HOME="$HOME"
ENV_FILE=/etc/tvdisplay.env

info() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }

if [ "$(id -u)" -eq 0 ]; then
  echo "Spusti skript ako bežný používateľ (ten, ktorý sa prihlasuje do grafického prostredia), nie ako root."
  echo "Skript si sudo vypýta sám."
  exit 1
fi

# --- 1. Systémové balíčky -------------------------------------------------
info "Inštalujem systémové balíčky (Chromium, unclutter, ...)"
sudo apt-get update
sudo apt-get install -y git curl ca-certificates xz-utils x11-xserver-utils unclutter
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
fi

# --- 2. Node.js -----------------------------------------------------------
need_node=1
if command -v node >/dev/null 2>&1; then
  current_major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$current_major" -ge "$NODE_MAJOR" ] && need_node=0
fi

if [ "$need_node" -eq 1 ]; then
  case "$(uname -m)" in
    armv7l|armv6l|armhf) node_arch=armv7l ;;
    aarch64|arm64) node_arch=arm64 ;;
    x86_64) node_arch=x64 ;;
    *) echo "Nepodporovaná architektúra: $(uname -m)"; exit 1 ;;
  esac
  info "Inštalujem Node.js ${NODE_MAJOR} (${node_arch}) do /usr/local"
  base_url="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  tmp_dir="$(mktemp -d)"
  curl -fsSL "${base_url}/SHASUMS256.txt" -o "${tmp_dir}/SHASUMS256.txt"
  node_file="$(grep -o "node-v[0-9.]*-linux-${node_arch}\.tar\.xz" "${tmp_dir}/SHASUMS256.txt" | head -n1)"
  curl -fSL "${base_url}/${node_file}" -o "${tmp_dir}/${node_file}"
  (cd "$tmp_dir" && grep " ${node_file}\$" SHASUMS256.txt | sha256sum -c -)
  sudo tar -xJf "${tmp_dir}/${node_file}" -C /usr/local --strip-components=1 \
    --exclude=CHANGELOG.md --exclude=LICENSE --exclude=README.md
  rm -rf "$tmp_dir"
  hash -r
fi
NODE_BIN="$(command -v node)"
info "Node.js $(node -v) ($NODE_BIN)"

# --- 3. Build aplikácie ---------------------------------------------------
info "Inštalujem závislosti a buildujem aplikáciu (na Orange Pi to môže trvať niekoľko minút)"
cd "$APP_DIR"
# Orange Pi PC má len 1 GB RAM - obmedzíme pamäť pre Node, zvyšok pokryje swap/zram
export NODE_OPTIONS="--max-old-space-size=700"
npm ci --no-audit --no-fund
npm run build
unset NODE_OPTIONS

# --- 4. Odkiaľ brať piesne a obrázky ---------------------------------------
# Prázdna adresa = dáta z GitHubu (pôvodný spôsob, úpravy cez ovládanie)
if [ -n "${TVDISPLAY_DATA_URL+x}" ]; then
  data_url="$TVDISPLAY_DATA_URL"
elif [ -f "$ENV_FILE" ]; then
  data_url="$(sed -n 's/^DATA_URL=//p' "$ENV_FILE")"
  info "Ponechávam adresu dát: ${data_url:-(GitHub)}"
else
  info "Napojenie na administráciu"
  echo "Zadaj adresu dát kostola z administrácie (záložka Kostoly -> Adresa pre Orange Pi),"
  echo "napr. https://mojnas.synology.me/api/public/churches/kostol-sv-martina"
  read -rp "Adresa (Enter = bez administrácie, dáta z GitHubu): " data_url
fi
data_url="${data_url%/}"
if [ -n "$data_url" ]; then
  if curl -fsS --max-time 10 "${data_url}/songs.json" >/dev/null; then
    info "Administrácia je dostupná: ${data_url}"
  else
    warn "Adresu ${data_url} sa teraz nepodarilo načítať - skontroluj ju (displej použije posledné uložené dáta)."
  fi
fi
printf 'DATA_URL=%s\n' "$data_url" | sudo tee "$ENV_FILE" >/dev/null

# --- 5. Systemd služba pre server ----------------------------------------
info "Vytváram službu tvdisplay (port ${PORT})"
sudo tee /etc/systemd/system/tvdisplay.service >/dev/null <<EOF
[Unit]
Description=TV Display server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
Environment=CACHE_DIR=${APP_DIR}/data-cache
EnvironmentFile=-${ENV_FILE}
ExecStart=${NODE_BIN} ${APP_DIR}/server/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable tvdisplay.service
sudo systemctl restart tvdisplay.service

# --- 6. Kiosk - displej po prihlásení na celej obrazovke ------------------
info "Nastavujem automatické spustenie displeja po prihlásení"
chmod +x "${APP_DIR}/orangepi/kiosk.sh"
mkdir -p "${APP_HOME}/.config/autostart"
cat > "${APP_HOME}/.config/autostart/tvdisplay-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=TV Display
Exec=env PORT=${PORT} ${APP_DIR}/orangepi/kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

# --- Hotovo ---------------------------------------------------------------
ip_addr="$(hostname -I 2>/dev/null | awk '{print $1}')"
info "Hotovo!"
cat <<EOF

  Server beží ako služba "tvdisplay" (stav: sudo systemctl status tvdisplay).

  Displej (TV):   http://localhost:${PORT}/#display
                  - otvorí sa sám po prihlásení do grafického prostredia
                  - hneď ho spustíš príkazom: ${APP_DIR}/orangepi/kiosk.sh
  Ovládanie:      http://${ip_addr:-<IP-adresa-Orange-Pi>}:${PORT}/#control
                  - otvor v mobile / notebooku v tej istej sieti

  Aby sa displej spustil sám po zapnutí, zapni automatické prihlásenie do
  grafického prostredia (Armbian: sudo armbian-config -> System -> Desktop / Autologin).

  Dáta kostola:   ${data_url:-GitHub (bez administrácie)}

  Aktualizácia aplikácie:
    cd ${APP_DIR} && git pull && ./orangepi/install.sh
EOF
if [ -z "${ip_addr}" ]; then
  warn "Nepodarilo sa zistiť IP adresu - zisti ju príkazom: hostname -I"
fi
