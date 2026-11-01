#!/bin/bash
# SongDisplay – inštalátor pre Orange Pi PC (Armbian / Debian / Ubuntu).
# Súbor obsahuje hotovú aplikáciu, na zariadení sa nič nekompiluje.
#
# Spustenie:   sudo bash tvdisplay-orangepi-install.sh
# Voľby:       --yes            bez otázok (TV áno, PowerPoint áno, bez PIN a tokenu)
#              --no-kiosk       nezobrazovať aplikáciu na TV pripojenej k tomuto zariadeniu
#              --no-powerpoint  neinštalovať LibreOffice
#
# Opätovné spustenie aplikáciu aktualizuje. Nastavenia, piesne ani prezentácie nezmení.
set -euo pipefail

APP_DIR=/opt/tvdisplay
NODE_DIR=/opt/tvdisplay-node
HOME_DIR=/var/lib/tvdisplay
APP_USER=tvdisplay
NODE_MAJOR=22
APP_PORT=5173
STATE_PORT=3002

ASSUME_YES=0
WANT_KIOSK=ask
WANT_POWERPOINT=ask
for arg in "$@"; do
  case "$arg" in
    --yes) ASSUME_YES=1 ;;
    --no-kiosk) WANT_KIOSK=no ;;
    --no-powerpoint) WANT_POWERPOINT=no ;;
    *) echo "Neznáma voľba: $arg"; exit 2 ;;
  esac
done

SELF=$(readlink -f "$0")
if [ "$(id -u)" -ne 0 ]; then
  exec sudo bash "$SELF" "$@"
fi

step() { echo; echo "==> $*"; }
warn() { echo "POZOR: $*" >&2; }
die() { echo "CHYBA: $*" >&2; exit 1; }

ask_yes() { # otázka, predvolene áno
  [ "$ASSUME_YES" -eq 1 ] && return 0
  local answer
  read -r -p "$1 [A/n]: " answer </dev/tty || return 0
  case "$answer" in [nN]*) return 1 ;; *) return 0 ;; esac
}

ask_value() { # otázka, skrytý vstup: 1 = áno
  [ "$ASSUME_YES" -eq 1 ] && return 0
  local answer=""
  if [ "${2:-0}" -eq 1 ]; then
    read -r -s -p "$1: " answer </dev/tty || true
    echo >&2
  else
    read -r -p "$1: " answer </dev/tty || true
  fi
  printf '%s' "$answer"
}

apt_candidate() { # existuje balík v repozitári?
  local candidate
  candidate=$(apt-cache policy "$1" 2>/dev/null | awk '/Candidate:/ {print $2; exit}')
  [ -n "$candidate" ] && [ "$candidate" != "(none)" ]
}

apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$@"
}

# --- Kontroly ------------------------------------------------------------

case "$(uname -m)" in
  armv7l) NODE_ARCH=armv7l ;;
  aarch64) NODE_ARCH=arm64 ;;
  x86_64) NODE_ARCH=x64 ;;
  *) die "Nepodporovaný procesor: $(uname -m)" ;;
esac
command -v apt-get >/dev/null || die "Inštalátor potrebuje systém s apt (Armbian, Debian, Ubuntu)."

PAYLOAD_LINE=$(grep -anm1 '^__PAYLOAD_BELOW__$' "$SELF" | cut -d: -f1)
[ -n "$PAYLOAD_LINE" ] || die "Súbor je poškodený, chýba v ňom aplikácia."

FREE_MB=$(df -Pm / | awk 'NR==2 {print $4}')
[ "$FREE_MB" -ge 1000 ] || die "Na karte je voľných iba $FREE_MB MB, treba aspoň 1 GB."

# Orange Pi PC nemá hodiny s batériou: bez správneho času zlyhá HTTPS aj liturgická téma
timedatectl set-ntp true 2>/dev/null || true

# --- Otázky (všetky naraz, potom už inštalácia beží sama) ----------------

echo "SongDisplay – inštalácia na $(uname -m)"

ENV_EXISTS=0
[ -f "$APP_DIR/.env" ] && ENV_EXISTS=1
CONTROL_PIN=""
GITHUB_TOKEN=""
if [ "$ENV_EXISTS" -eq 0 ]; then
  CONTROL_PIN=$(ask_value "PIN na ovládanie (prázdne = bez PIN)")
  echo "GitHub token je potrebný na trvalé ukladanie úprav piesní. Možno ho doplniť aj neskôr v $APP_DIR/.env"
  GITHUB_TOKEN=$(ask_value "GitHub token (prázdne = preskočiť, nezobrazuje sa)" 1)
fi

if [ "$WANT_KIOSK" = ask ]; then
  if ask_yes "Zobrazovať aplikáciu na TV pripojenej cez HDMI k tomuto zariadeniu?"; then WANT_KIOSK=yes; else WANT_KIOSK=no; fi
fi
if [ "$WANT_POWERPOINT" = ask ]; then
  if ask_yes "Nainštalovať podporu PowerPointu (LibreOffice, približne 500 MB)?"; then WANT_POWERPOINT=yes; else WANT_POWERPOINT=no; fi
fi

DISPLAY_MANAGER_ACTIVE=0
if [ "$WANT_KIOSK" = yes ] && systemctl is-active --quiet display-manager 2>/dev/null; then
  DISPLAY_MANAGER_ACTIVE=1
  if ! ask_yes "Beží tu pracovné prostredie. Má ho po reštarte nahradiť obrazovka SongDisplay?"; then
    WANT_KIOSK=no
    DISPLAY_MANAGER_ACTIVE=0
    warn "Obrazovka sa nenastaví. Otvor http://localhost:$APP_PORT/#display v prehliadači ručne."
  fi
fi

# --- Systémové balíky ----------------------------------------------------

step "Aktualizujem zoznam balíkov"
apt-get update || warn "Zoznam balíkov sa nepodarilo celý obnoviť, pokračujem."
apt_install ca-certificates curl tar xz-utils

# --- Node.js -------------------------------------------------------------

if [ -x "$NODE_DIR/bin/node" ] && "$NODE_DIR/bin/node" -v 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
  step "Node.js $("$NODE_DIR/bin/node" -v) je už nainštalovaný"
else
  step "Inštalujem Node.js $NODE_MAJOR pre $NODE_ARCH"
  BASE="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  SUMS=$(curl -fsSL "$BASE/SHASUMS256.txt") || die "Nepodarilo sa spojiť s nodejs.org. Skontroluj internet a dátum: $(date)"
  LINE=$(printf '%s\n' "$SUMS" | grep "linux-$NODE_ARCH\.tar\.xz$") || die "Pre $NODE_ARCH nie je Node.js $NODE_MAJOR k dispozícii."
  NODE_SHA=$(printf '%s' "$LINE" | awk '{print $1}')
  NODE_FILE=$(printf '%s' "$LINE" | awk '{print $2}')
  NODE_TMP=$(mktemp -d)
  curl -fL --progress-bar -o "$NODE_TMP/$NODE_FILE" "$BASE/$NODE_FILE"
  echo "$NODE_SHA  $NODE_TMP/$NODE_FILE" | sha256sum -c --quiet - || die "Stiahnutý Node.js je poškodený."
  rm -rf "$NODE_DIR"
  mkdir -p "$NODE_DIR"
  tar xJf "$NODE_TMP/$NODE_FILE" -C "$NODE_DIR" --strip-components=1 --no-same-owner
  rm -rf "$NODE_TMP"
  "$NODE_DIR/bin/node" -v >/dev/null || die "Node.js sa na tomto systéme nespustí (potrebuje glibc 2.28, teda Debian 10 alebo novší)."
fi

# --- Odkladací priestor --------------------------------------------------

# 1 GB RAM nestačí na prehliadač a prevod PowerPointu naraz
SWAP_MB=$(free -m | awk '/^Swap:/ {print $2}')
if [ "${SWAP_MB:-0}" -lt 512 ] && [ ! -f /var/swap.tvdisplay ] && [ "$FREE_MB" -ge 4000 ]; then
  step "Vytváram odkladací súbor 1 GB"
  if dd if=/dev/zero of=/var/swap.tvdisplay bs=1M count=1024 status=none \
    && chmod 600 /var/swap.tvdisplay && mkswap /var/swap.tvdisplay >/dev/null && swapon /var/swap.tvdisplay; then
    grep -q '/var/swap.tvdisplay' /etc/fstab || echo '/var/swap.tvdisplay none swap sw 0 0' >>/etc/fstab
  else
    rm -f /var/swap.tvdisplay
    warn "Odkladací súbor sa nepodarilo vytvoriť."
  fi
fi

# --- Aplikácia -----------------------------------------------------------

step "Inštalujem aplikáciu do $APP_DIR"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$HOME_DIR" --shell /bin/bash "$APP_USER"
mkdir -p "$HOME_DIR"
chown "$APP_USER:$APP_USER" "$HOME_DIR"

systemctl stop tvdisplay-kiosk.service 2>/dev/null || true
systemctl stop tvdisplay.service 2>/dev/null || true

PAYLOAD_TMP=$(mktemp -d)
trap 'rm -rf "$PAYLOAD_TMP"' EXIT
tail -n +"$((PAYLOAD_LINE + 1))" "$SELF" | tar xzf - -C "$PAYLOAD_TMP" --no-same-owner

mkdir -p "$APP_DIR/uploads"
rm -rf "$APP_DIR/dist" "$APP_DIR/server" "$APP_DIR/node_modules" "$APP_DIR/Texty"
cp -R "$PAYLOAD_TMP/dist" "$PAYLOAD_TMP/server" "$PAYLOAD_TMP/node_modules" "$PAYLOAD_TMP/Texty" "$PAYLOAD_TMP/package.json" "$APP_DIR/"
# Piesne a obrázky iba pri prvej inštalácii, neskôr by prepísali úpravy
for file in songs.json images.json; do
  [ -f "$APP_DIR/$file" ] || cp "$PAYLOAD_TMP/$file" "$APP_DIR/$file"
done

if [ "$ENV_EXISTS" -eq 0 ]; then
  (
    umask 077
    {
      echo "GITHUB_TOKEN=$GITHUB_TOKEN"
      echo "GITHUB_OWNER=JanKarajos"
      echo "GITHUB_REPO=tvdisplay"
      echo "GITHUB_BRANCH=main"
      echo "CONTROL_PIN=$CONTROL_PIN"
      echo "STATE_PORT=$STATE_PORT"
      echo "APP_PORT=$APP_PORT"
    } >"$APP_DIR/.env"
  )
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/.env"

cat >/etc/systemd/system/tvdisplay.service <<EOF
[Unit]
Description=SongDisplay server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=HOME=$HOME_DIR
ExecStart=$NODE_DIR/bin/node server/index.js --serve
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# --- PowerPoint ----------------------------------------------------------

if [ "$WANT_POWERPOINT" = yes ]; then
  step "Inštalujem LibreOffice (môže to trvať aj 15 minút)"
  apt_install libreoffice-impress fonts-dejavu fonts-liberation \
    || warn "LibreOffice sa nepodarilo nainštalovať. PDF budú fungovať, PowerPoint nie."
fi

# --- Obrazovka na TV -----------------------------------------------------

BROWSER=""
if [ "$WANT_KIOSK" = yes ]; then
  step "Nastavujem obrazovku na TV (môže to trvať aj 15 minút)"
  . /etc/os-release 2>/dev/null || true
  if apt_candidate chromium; then
    BROWSER=chromium
  elif [ "${ID:-}" != ubuntu ] && apt_candidate chromium-browser; then
    BROWSER=chromium-browser
  elif apt_candidate firefox-esr; then
    BROWSER=firefox-esr
  fi

  if [ -z "$BROWSER" ]; then
    warn "V repozitári systému nie je použiteľný prehliadač, obrazovka sa nenastaví."
    WANT_KIOSK=no
  elif ! apt_install "$BROWSER" xserver-xorg xserver-xorg-legacy xserver-xorg-video-fbdev xinit x11-xserver-utils fonts-dejavu; then
    warn "Obrazovku sa nepodarilo nainštalovať."
    WANT_KIOSK=no
  fi
fi

if [ "$WANT_KIOSK" = yes ]; then
  for group in video input render tty audio; do
    getent group "$group" >/dev/null && usermod -aG "$group" "$APP_USER"
  done

  mkdir -p /etc/X11
  printf 'allowed_users=anybody\nneeds_root_rights=yes\n' >/etc/X11/Xwrapper.config

  cat >"$APP_DIR/kiosk.sh" <<EOF
#!/bin/bash
# Obrazovka na TV: bez šetriča a uspávania, po páde ju systemd spustí znova
xset s off
xset s noblank
xset -dpms
until curl -fsS -o /dev/null --max-time 3 http://localhost:$APP_PORT/health; do sleep 2; done
URL='http://localhost:$APP_PORT/#display'
if [ "$BROWSER" = firefox-esr ]; then
  exec firefox-esr --kiosk "\$URL"
fi
exec $BROWSER --kiosk --incognito --no-first-run --noerrdialogs --disable-infobars \\
  --disable-session-crashed-bubble --disable-translate --disable-gpu --password-store=basic \\
  --check-for-update-interval=31536000 --renderer-process-limit=2 --disk-cache-size=33554432 \\
  --user-data-dir=$HOME_DIR/browser "\$URL"
EOF
  chmod 755 "$APP_DIR/kiosk.sh"
  chown "$APP_USER:$APP_USER" "$APP_DIR/kiosk.sh"

  cat >/etc/systemd/system/tvdisplay-kiosk.service <<EOF
[Unit]
Description=SongDisplay obrazovka na TV
After=tvdisplay.service systemd-user-sessions.service
Wants=tvdisplay.service
Conflicts=getty@tty7.service

[Service]
User=$APP_USER
Environment=HOME=$HOME_DIR
PAMName=login
TTYPath=/dev/tty7
StandardInput=tty
StandardOutput=journal
StandardError=journal
ExecStart=/usr/bin/xinit $APP_DIR/kiosk.sh -- :0 vt7 -nolisten tcp -nocursor -keeptty
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
fi

# --- Spustenie -----------------------------------------------------------

step "Spúšťam SongDisplay"
systemctl daemon-reload
systemctl enable tvdisplay.service >/dev/null
systemctl restart tvdisplay.service

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$APP_PORT/tcp" >/dev/null
fi

SERVER_OK=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 3 "http://localhost:$APP_PORT/health"; then
    SERVER_OK=1
    break
  fi
  sleep 2
done
[ "$SERVER_OK" -eq 1 ] || die "Server sa nespustil. Pozri: journalctl -u tvdisplay -n 50"

REBOOT_NEEDED=0
if [ "$WANT_KIOSK" = yes ]; then
  systemctl enable tvdisplay-kiosk.service >/dev/null
  if [ "$DISPLAY_MANAGER_ACTIVE" -eq 1 ]; then
    # Vypne sa až po reštarte, aby sa tento terminál na pracovnej ploche nezavrel
    DM_UNIT=$(systemctl show -p Id --value display-manager 2>/dev/null || true)
    systemctl disable "${DM_UNIT:-display-manager}" 2>/dev/null || true
    REBOOT_NEEDED=1
  else
    systemctl restart tvdisplay-kiosk.service
  fi
else
  systemctl disable tvdisplay-kiosk.service 2>/dev/null || true
fi

IP_ADDRESS=$(hostname -I 2>/dev/null | awk '{print $1}')
IP_ADDRESS=${IP_ADDRESS:-<IP-adresa>}

echo
echo "Hotovo."
echo "  Ovládanie (mobil, PC): http://$IP_ADDRESS:$APP_PORT/#control"
echo "  Obrazovka:             http://$IP_ADDRESS:$APP_PORT/#display"
echo "  Stav a záznamy:        systemctl status tvdisplay  /  journalctl -u tvdisplay -f"
echo "  Nastavenia:            $APP_DIR/.env (po zmene: sudo systemctl restart tvdisplay)"
if [ "$REBOOT_NEEDED" -eq 1 ]; then
  echo "  Obrazovka na TV sa zapne po reštarte: sudo reboot"
fi
exit 0
__PAYLOAD_BELOW__
