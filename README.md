# SongDisplay — Vite + React + Tailwind

Aplikácia na zobrazovanie textov piesní, obrázkov a PDF prezentácií na TV.
Má dve stránky: **Ovládanie** (`#control`) a **Obrazovka** (`#display`).
Piesne (`songs.json`), obrázky (`images.json`) a vlastné kategórie (`categories.json`) sa načítavajú z tohto GitHub repozitára.

## Spustenie na Orange Pi PC

Orange Pi pripojené k TV cez HDMI zobrazuje displej. Ovláda sa z mobilu alebo notebooku v tej istej sieti.

Potrebný je Armbian (alebo iný Debian) s grafickým prostredím. Na Orange Pi spusti:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/JanKarajos/tvdisplay.git
cd tvdisplay
./orangepi/install.sh
```

Skript:
- nainštaluje Chromium a Node.js 22,
- zbuilduje aplikáciu,
- vytvorí službu `tvdisplay`, ktorá po zapnutí spustí server na porte 8080,
- nastaví, aby sa po prihlásení displej otvoril na celej obrazovke.

Potom:
- **Displej:** otvorí sa sám po prihlásení. Aby sa to stalo hneď po zapnutí, zapni automatické prihlásenie (Armbian: `sudo armbian-config` → System → Desktop / Autologin).
- **Ovládanie:** v mobile otvor `http://<IP-adresa-Orange-Pi>:8080/#control`. IP adresu zistíš príkazom `hostname -I`; skript ju vypíše na konci.

Aktualizácia na novú verziu:

```bash
cd tvdisplay && git pull && ./orangepi/install.sh
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

Vývojový režim:

```bash
npm install
npm run dev
```

- Ovládanie: http://localhost:5173/#control
- Displej: http://localhost:5173/#display

Vo vývojovom režime nebeží server, a stav sa synchronizuje cez `localStorage`. Ovládanie a displej preto musia byť otvorené v **tom istom prehliadači** na tom istom počítači.

## Ukladanie na GitHub

Nové texty, obrázky, kategórie a PDF sa ukladajú do tohto repozitára cez GitHub API. V ovládaní treba v sekcii „GitHub Sync“ vyplniť Personal Access Token s právom zapisovať do repozitára (*Contents: write*).
- PDF prezentácie sa nahrávajú ako samostatné súbory do priečinka `pdfs/`.
- Vlastné kategórie sa ukladajú do `categories.json`.
