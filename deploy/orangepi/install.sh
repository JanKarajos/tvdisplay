#!/bin/bash
# SongDisplay – inštalátor pre Orange Pi PC (Armbian / Debian / Ubuntu).
# Súbor obsahuje hotovú aplikáciu, na zariadení sa nič nekompiluje.
#
# Spustenie:   sudo bash tvdisplay-orangepi-install.sh
# Voľby:       --yes            bez otázok (TV áno, PowerPoint áno, bez PIN a tokenu)
#              --no-kiosk       nezobrazovať aplikáciu na TV pripojenej k tomuto zariadeniu
#              --no-powerpoint  neinštalovať LibreOffice
#              --nas-url=URL    piesne, fotky a prezentácie v priečinku na NAS (Synology WebDAV),
#                               napr. https://mojnas.synology.me:5006/tvdisplay/kostol-sv-martina
#              --nas-user=MENO, --nas-password=HESLO   prihlásenie do NAS
#              --nas-ignore-cert  prijať certifikát vystavený samotným NAS (https v miestnej sieti)
#                               pri aktualizácii tieto voľby zmenia nastavenia, --nas-url= napojenie zruší
#              --tailscale      spojenie s NAS v inej sieti cez Tailscale (bez nastavovania routera);
#                               bez kľúča sa zobrazí odkaz na prihlásenie do Tailscale účtu
#              --tailscale-authkey=KĽÚČ   prihlásenie do Tailscale kľúčom (admin konzola Tailscale -> Settings -> Keys)
#              --no-tailscale   nepýtať sa na Tailscale
#              --church-url=URL piesne kostola z administrácie (Docker na NAS, adresa zo záložky Kostoly)
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
CHURCH_URL_SET=0
CHURCH_DATA_URL=""
NAS_SET=0
NAS_URL=""
NAS_USER=""
NAS_PASSWORD=""
NAS_IGNORE_CERT=0
WANT_TAILSCALE=ask
TAILSCALE_AUTHKEY=""
for arg in "$@"; do
  case "$arg" in
    --yes) ASSUME_YES=1 ;;
    --no-kiosk) WANT_KIOSK=no ;;
    --no-powerpoint) WANT_POWERPOINT=no ;;
    --church-url=*) CHURCH_URL_SET=1; CHURCH_DATA_URL="${arg#--church-url=}" ;;
    --nas-url=*) NAS_SET=1; NAS_URL="${arg#--nas-url=}" ;;
    --nas-user=*) NAS_SET=1; NAS_USER="${arg#--nas-user=}" ;;
    --nas-password=*) NAS_SET=1; NAS_PASSWORD="${arg#--nas-password=}" ;;
    --nas-ignore-cert) NAS_SET=1; NAS_IGNORE_CERT=1 ;;
    --tailscale) WANT_TAILSCALE=yes ;;
    --tailscale-authkey=*) WANT_TAILSCALE=yes; TAILSCALE_AUTHKEY="${arg#--tailscale-authkey=}" ;;
    --no-tailscale) WANT_TAILSCALE=no ;;
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

tailscale_connected() { # je zariadenie prihlásené do Tailscale?
  command -v tailscale >/dev/null && tailscale status >/dev/null 2>&1
}

# Overí, či sú piesne dostupné (po pripojení Tailscale, keď už je nainštalovaný curl)
check_sources() {
  if [ -n "$NAS_URL" ]; then
    local cert=()
    [ "$NAS_IGNORE_CERT" -eq 1 ] && cert=(-k)
    local status
    status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${cert[@]}" -u "$NAS_USER:$NAS_PASSWORD" "$NAS_URL/songs.json" 2>/dev/null || true)
    case "$status" in
      200) echo "Priečinok na NAS je dostupný." ;;
      404) echo "Priečinok na NAS je prázdny – piesne, fotky a prezentácie tohto zariadenia sa naň nahrajú pri prvom spustení." ;;
      401|403) warn "NAS odmietol prihlásenie – skontroluj meno, heslo a právo používateľa na WebDAV." ;;
      000) warn "NAS sa nepodarilo dosiahnuť ($NAS_URL). Skontroluj adresu a spojenie (Tailscale: sudo tailscale status). Pri https s vlastným certifikátom NAS pridaj --nas-ignore-cert." ;;
      *) warn "NAS vrátil chybu $status pre $NAS_URL." ;;
    esac
  fi
  if [ -n "$CHURCH_DATA_URL" ]; then
    if curl -fsS -o /dev/null --max-time 10 "$CHURCH_DATA_URL/songs.json"; then
      echo "Administrácia kostola je dostupná."
    else
      warn "Adresu $CHURCH_DATA_URL sa teraz nepodarilo načítať. Skontroluj ju; Orange Pi to bude skúšať každú minútu."
    fi
  fi
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
  if [ "$NAS_SET" -eq 0 ] && [ "$CHURCH_URL_SET" -eq 0 ]; then
    echo "Piesne, fotky a prezentácie môžu byť v priečinku na NAS (Synology, balík WebDAV Server),"
    echo "napr. https://mojnas.synology.me:5006/tvdisplay/kostol-sv-martina alebo http://192.168.1.10:5005/tvdisplay/kostol-sv-martina"
    NAS_URL=$(ask_value "Adresa priečinka na NAS (prázdne = piesne z GitHubu)")
    if [ -n "$NAS_URL" ]; then
      NAS_USER=$(ask_value "Meno používateľa na NAS")
      NAS_PASSWORD=$(ask_value "Heslo používateľa na NAS (nezobrazuje sa)" 1)
    fi
  fi
  if [ -z "$CHURCH_DATA_URL" ] && [ -z "$NAS_URL" ]; then
    echo "GitHub token je potrebný na trvalé ukladanie úprav piesní. Možno ho doplniť aj neskôr v $APP_DIR/.env"
    GITHUB_TOKEN=$(ask_value "GitHub token (prázdne = preskočiť, nezobrazuje sa)" 1)
  fi
fi
CHURCH_DATA_URL="${CHURCH_DATA_URL%/}"
NAS_URL="${NAS_URL%/}"
# Pri aktualizácii platia nastavenia NAS z .env, pokiaľ ich voľby nemenia
env_value() { sed -n "s/^$1=//p" "$APP_DIR/.env" | tail -n1; }
if [ "$ENV_EXISTS" -eq 1 ]; then
  if [ "$NAS_SET" -eq 0 ]; then
    NAS_URL=$(env_value NAS_URL)
    [ "$(env_value NAS_IGNORE_CERT)" = 1 ] && NAS_IGNORE_CERT=1
  fi
  [ -z "$NAS_USER" ] && NAS_USER=$(env_value NAS_USER)
  [ -z "$NAS_PASSWORD" ] && NAS_PASSWORD=$(env_value NAS_PASSWORD)
fi

# NAS v inej sieti: Tailscale vytvorí šifrované spojenie bez presmerovania portov na routeri
if [ "$WANT_TAILSCALE" = ask ]; then
  WANT_TAILSCALE=no
  if [ -n "$NAS_URL" ] && [ "$ASSUME_YES" -eq 0 ] && ! tailscale_connected; then
    if ask_yes "Je NAS v inej sieti ako toto zariadenie? Pripojiť sa k nemu cez Tailscale?"; then WANT_TAILSCALE=yes; fi
  fi
fi
if [ "$WANT_TAILSCALE" = yes ] && [ -z "$TAILSCALE_AUTHKEY" ] && ! tailscale_connected; then
  echo "Kľúč vytvoríš v admin konzole Tailscale (Settings -> Keys -> Generate auth key). Bez kľúča sa zobrazí odkaz na prihlásenie."
  TAILSCALE_AUTHKEY=$(ask_value "Tailscale kľúč (prázdne = prihlásiť sa odkazom, nezobrazuje sa)" 1)
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

# --- Tailscale (spojenie s NAS v inej sieti) -----------------------------

if [ "$WANT_TAILSCALE" = yes ]; then
  step "Pripájam Tailscale"
  if ! command -v tailscale >/dev/null; then
    # Oficiálny inštalačný skript Tailscale (pridá ich repozitár a nainštaluje balík)
    curl -fsSL https://tailscale.com/install.sh | sh || warn "Tailscale sa nepodarilo nainštalovať."
  fi
  if command -v tailscale >/dev/null; then
    systemctl enable --now tailscaled >/dev/null 2>&1 || true
    TS_NAME="tvdisplay-$(hostname | tr -cd 'a-zA-Z0-9-')"
    if tailscale_connected; then
      echo "Tailscale je už pripojený."
    elif [ -n "$TAILSCALE_AUTHKEY" ]; then
      tailscale up --authkey="$TAILSCALE_AUTHKEY" --hostname="$TS_NAME" || warn "Prihlásenie do Tailscale kľúčom zlyhalo. Skús: sudo tailscale up"
    elif [ "$ASSUME_YES" -eq 0 ]; then
      echo "Otvor odkaz, ktorý sa zobrazí (napr. v mobile), a prihlás sa do Tailscale účtu, v ktorom je NAS."
      tailscale up --hostname="$TS_NAME" || warn "Tailscale sa nepripojil. Skús neskôr: sudo tailscale up"
    else
      warn "Tailscale je nainštalovaný, ale neprihlásený. Spusti: sudo tailscale up"
    fi
  fi
fi

command -v curl >/dev/null && check_sources

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
      echo "CHURCH_DATA_URL=$CHURCH_DATA_URL"
      echo "NAS_URL=$NAS_URL"
      echo "NAS_USER=$NAS_USER"
      echo "NAS_PASSWORD=$NAS_PASSWORD"
      echo "NAS_IGNORE_CERT=$NAS_IGNORE_CERT"
    } >"$APP_DIR/.env"
  )
else
  # Aktualizácia s voľbami: zmeň iba zadané nastavenia, ostatné ostanú
  set_env() {
    sed -i "/^$1=/d" "$APP_DIR/.env"
    printf '%s=%s\n' "$1" "$2" >>"$APP_DIR/.env"
  }
  [ "$CHURCH_URL_SET" -eq 1 ] && set_env CHURCH_DATA_URL "$CHURCH_DATA_URL"
  if [ "$NAS_SET" -eq 1 ]; then
    set_env NAS_URL "$NAS_URL"
    [ -n "$NAS_USER" ] && set_env NAS_USER "$NAS_USER"
    [ -n "$NAS_PASSWORD" ] && set_env NAS_PASSWORD "$NAS_PASSWORD"
    set_env NAS_IGNORE_CERT "$NAS_IGNORE_CERT"
  fi
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
CURRENT_CHURCH_URL=$(sed -n 's/^CHURCH_DATA_URL=//p' "$APP_DIR/.env" | tail -n1)
CURRENT_NAS_URL=$(sed -n 's/^NAS_URL=//p' "$APP_DIR/.env" | tail -n1)
if [ -n "$CURRENT_CHURCH_URL" ]; then
  echo "  Piesne:                administrácia $CURRENT_CHURCH_URL"
elif [ -n "$CURRENT_NAS_URL" ]; then
  echo "  Piesne:                NAS $CURRENT_NAS_URL"
  if tailscale_connected; then
    echo "  Tailscale:             pripojený ($(tailscale ip -4 2>/dev/null | head -n1))"
  fi
else
  echo "  Piesne:                GitHub"
fi
if [ "$REBOOT_NEEDED" -eq 1 ]; then
  echo "  Obrazovka na TV sa zapne po reštarte: sudo reboot"
fi
exit 0
__PAYLOAD_BELOW__
