# SongDisplay — Vite + React + Tailwind

Aplikácia na zobrazovanie textov piesní, obrázkov a PDF prezentácií na TV.

Skladá sa z dvoch častí:

- **Administrácia** (`#admin`) beží centrálne na Synology NAS.
  - Po prihlásení sa v nej upravujú piesne, kategórie, obrázky a PDF.
  - Každý kostol má vlastné piesne.
  - Každý používateľ (editor) spravuje len kostol, ktorý mu je priradený.
  - Administrátor spravuje všetky kostoly a používateľov.
- **Ovládanie** (`#control`) a **Obrazovka** (`#display`) bežia na Orange Pi v kostole, ktoré je pripojené k TV.
  - Dáta svojho kostola si berie z administrácie a ukladá ich, takže funguje aj bez internetu.

## Administrácia na Synology NAS

1. V Centre balíkov nainštaluj **Container Manager**.
2. Stiahni tento repozitár (GitHub → *Code* → *Download ZIP*) a cez File Station ho rozbaľ, napr. do `/docker/tvdisplay`.
3. V súbore `docker-compose.yml` zmeň `ADMIN_PASSWORD` (heslo prvého administrátora, použije sa len pri prvom spustení).
4. Container Manager → **Projekt** → **Vytvoriť** → cesta `/docker/tvdisplay` → použiť existujúci `docker-compose.yml` → Ďalej → Hotovo.
   Image sa zostaví a spustí; prvé zostavenie trvá niekoľko minút.
5. Otvor `http://<IP-NAS>:8080` a prihlás sa ako `admin`. Potom:
   - zmeň si heslo (tlačidlo **Zmeniť heslo**),
   - v záložke **Kostoly** pridaj kostoly. Voliteľne ich nechaj naplniť spevníkom JKS: každý kostol dostane vlastnú kópiu.
   - v záložke **Používatelia** vytvor editorov a priraď im kostol.

**Prístup z internetu** (aby sa editori a Orange Pi v kostoloch dostali k administrácii):

1. Ovládací panel → Prihlasovací portál → Rozšírené → **Reverzný proxy server**.
2. Pridaj pravidlo zo `https://<tvoja-adresa>:443` na `http://localhost:8080`.
3. Certifikát Let's Encrypt získaš v Ovládací panel → Zabezpečenie → Certifikát.

Používaj **HTTPS**, inak by heslá išli cez internet nezašifrované.

**Dáta** (používatelia, kostoly, piesne, obrázky, PDF) sú v priečinku `admin-data` vedľa `docker-compose.yml`. Zálohuj ho (napr. Hyper Backup). Zmazané kostoly sa presúvajú do `admin-data/deleted/`.

**Zabudnuté heslo administrátora:**

```bash
docker exec -it tvdisplay-admin node server/set-password.mjs admin NoveHeslo123 --admin
```

**Aktualizácia:**
1. Nahraj novú verziu súborov (bez priečinka `admin-data`).
2. V Container Manageri: Projekt → Akcia → **Zostaviť**.

## Orange Pi PC v kostole

Orange Pi pripojené k TV cez HDMI zobrazuje displej. Ovláda sa z mobilu alebo notebooku v tej istej sieti.

Potrebný je Armbian (alebo iný Debian) s grafickým prostredím. Na Orange Pi spusti:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/JanKarajos/tvdisplay.git
cd tvdisplay
./orangepi/install.sh
```

Skript sa opýta na **adresu dát kostola**. Nájdeš ju v administrácii v záložke Kostoly („Adresa pre Orange Pi“), napr. `https://mojnas.synology.me/api/public/churches/kostol-sv-martina`. Ak necháš adresu prázdnu, dáta sa berú z GitHubu ako predtým.

Skript ďalej:
- nainštaluje Chromium a Node.js 22,
- zbuilduje aplikáciu,
- vytvorí službu `tvdisplay`, ktorá po zapnutí spustí server na porte 8080,
- nastaví, aby sa po prihlásení displej otvoril na celej obrazovke.

Potom:
- **Displej:** otvorí sa sám po prihlásení. Aby sa to stalo hneď po zapnutí, zapni automatické prihlásenie (Armbian: `sudo armbian-config` → System → Desktop / Autologin).
- **Ovládanie:** v mobile otvor `http://<IP-adresa-Orange-Pi>:8080/#control`. IP adresu zistíš príkazom `hostname -I`; skript ju vypíše na konci.
- **Po úprave piesní v administrácii:** obnov stránku ovládania a displeja (alebo reštartuj Orange Pi).

Aktualizácia na novú verziu:

```bash
cd tvdisplay && git pull && ./orangepi/install.sh
```

Zmena adresy dát kostola:

```bash
TVDISPLAY_DATA_URL=https://mojnas.synology.me/api/public/churches/iny-kostol ./orangepi/install.sh
```

Užitočné príkazy:
- `sudo systemctl status tvdisplay` — stav servera
- `journalctl -u tvdisplay -f` — logy servera
- `./orangepi/kiosk.sh` — ručné otvorenie displeja na celej obrazovke

## Spustenie na počítači

Produkčný režim (rovnaký ako na Orange Pi; displej a ovládanie môžu byť na rôznych zariadeniach):

```bash
npm install
npm run build
npm start          # server na http://localhost:8080 (port sa dá zmeniť cez PORT=...)
```

Premenné prostredia servera:
- `DATA_DIR` — zapne administráciu a určí, kam sa ukladajú jej dáta (NAS),
- `DATA_URL` — adresa dát kostola z administrácie (Orange Pi),
- `CACHE_DIR` — kam si Orange Pi ukladá kópiu dát (predvolene `data-cache/`),
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — prvý administrátor.

Vývojový režim:

```bash
npm install
npm run dev
```

- Ovládanie: http://localhost:5173/#control
- Displej: http://localhost:5173/#display
- Administrácia: http://localhost:5173/#admin. V druhom termináli spusti aj `ADMIN_PASSWORD=heslo1234 npm run admin:dev`; dáta sa uložia do `admin-data/`.

Vo vývojovom režime sa stav synchronizuje cez `localStorage`. Ovládanie a displej preto musia byť otvorené v **tom istom prehliadači** na tom istom počítači.

## Bez administrácie (GitHub)

Ak Orange Pi nie je napojené na administráciu, piesne (`songs.json`), obrázky (`images.json`) a kategórie (`categories.json`) sa načítavajú z tohto GitHub repozitára. Nové texty, obrázky, kategórie a PDF sa potom ukladajú cez GitHub API priamo z ovládania. V sekcii „GitHub Sync“ treba vyplniť Personal Access Token s právom zapisovať do repozitára (*Contents: write*).
