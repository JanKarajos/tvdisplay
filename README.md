# SongDisplay (tvdisplay)

Zobrazovanie textov piesní, žalmov, obrázkov a PDF prezentácií na TV v kostole.
Ovládanie beží v prehliadači na mobile/PC, displej na zariadení pri TV (napr. Raspberry Pi v kiosk režime).

## Spustenie

```bash
npm install
cp .env.example .env   # doplň GITHUB_TOKEN a prípadne CONTROL_PIN
npm run prod           # zostaví aplikáciu a spustí server
```

- Ovládanie: `http://<IP>:5173/#control`
- Displej: `http://<IP>:5173/#display` (kláves **F** = celá obrazovka)

Vývoj s automatickým obnovovaním: `npm run dev` (server + Vite).

## Orange Pi PC

Inštalátor je jeden súbor s hotovou aplikáciou (na zariadení sa nič nekompiluje):

```bash
./scripts/build_orangepi_installer.sh                 # na počítači, vytvorí dist-orangepi/
sudo bash tvdisplay-orangepi-install.sh               # na Orange Pi (Armbian, Debian, Ubuntu)
```

Aplikácia sa nainštaluje do `/opt/tvdisplay` a spúšťa sa sama po zapnutí. Nastavenia sú v `/opt/tvdisplay/.env`.
Opätovné spustenie inštalátora aplikáciu aktualizuje a nezmení nastavenia, piesne ani prezentácie.
Voľby: `--yes`, `--no-kiosk` (bez obrazovky na TV), `--no-powerpoint` (bez LibreOffice).

## Ako to funguje

```
Mobil / PC (ovládanie) ──PATCH /api/state──►  server (port 3002)  ──WebSocket──►  všetky zariadenia
                                              │  state.json, uploads/, Texty/
                                              └─ GitHub (songs.json, images.json) – token je iba na serveri
```

- **Synchronizácia** cez WebSocket, zmeny sa prejavia okamžite. Pri výpadku sa klient sám pripojí znova.
  Bez servera funguje len v rámci jedného prehliadača (localStorage).
- **Piesne a obrázky** sa načítavajú z GitHubu. Keď nie je dostupný, použije sa lokálna kópia na serveri
  a potom posledná verzia uložená v prehliadači.
- **Ukladanie** (nový text, obrázok, PDF) ide cez server, ktorý súbor uloží lokálne aj na GitHub.
- **Prezentácie** (PDF, PPT, PPTX, ODP) sa nahrávajú na server do `uploads/`, v `songs.json` je iba odkaz.
  Počet strán sa zistí automaticky. PowerPoint server prevedie na PDF cez LibreOffice:
  na Raspberry Pi `sudo apt install libreoffice-impress` (bez neho funguje iba PDF).
- **Žalmy** sú pribalené v `Texty/Žalmy RRRR.json`. Server si chýbajúce dni aktuálneho a nasledujúceho roka
  sám sťahuje z `lc.kbs.sk` do `psalms/RRRR.json` (bez internetu to skúša znova každých 5 minút) a chýbajúci
  deň stiahne aj hneď, keď si ho niekto vyžiada. Nový rok teda netreba riešiť ručne.
- **PIN**: ak je v `.env` nastavený `CONTROL_PIN`, ovládanie si ho vypýta. Displej PIN nepotrebuje.

## Priebeh omše

1. V záložke **Omša** klikaj na piesne v zozname, každá sa pridá na koniec **poradia**.
   Žalm pridáš tlačidlom **+ Žalm** (predvolene najbližšia nedeľa). Poradie meníš ťahaním za úchyt ⠿.
2. Počas omše stačí stláčať **Ďalej** v spodnej lište (alebo → / PageDown / kliker):
   prechádzajú sa strofy a na poslednej strofe sa automaticky zobrazí ďalšia položka poradia.
3. **▶** zobrazí pieseň hneď, aj mimo poradia. Potom „Ďalej“ pokračuje v poradí tam, kde sa skončilo.
4. **Skryť** (kláves H) skryje text a ukáže pozadie.

Záložka **Obrazovka**: farebná téma TV (automaticky podľa liturgického obdobia), pozadie a voľba
„Text cez obrázok pozadia“. Záložka **Obsah**: nové texty, obrázky, PDF a stav synchronizácie.
Ikona ◐ v hlavičke prepína svetlý/tmavý režim ovládania.

## Ovládanie klávesnicou

| Kláves | Akcia |
| --- | --- |
| → / PageDown | ďalšia strofa, na poslednej strofe ďalšia položka poradia |
| ← / PageUp | predchádzajúca strofa, na prvej strofe predchádzajúca položka |
| H | skryť / zobraziť text na TV |

Fungujú aj bežné klikery na prezentácie (posielajú PageUp/PageDown).

## Ladenie

Ladiace výpisy v konzole zapneš príkazom `localStorage.setItem('tvdisplay-debug', '1')` alebo pridaním `?debug` do URL.

## Štruktúra

- `server/index.js` – API, WebSocket, GitHub, nahrávanie PDF, servírovanie `dist/`
- `src/api/stateClient.js` – zdieľaný stav a pripojenie
- `src/api/api.js` – knižnica piesní, obrázkov, PDF a žalmov
- `src/pages/ControlPage.jsx`, `src/components/control/*` – ovládanie
- `src/pages/DisplayPage.jsx`, `src/components/Stage.jsx` – displej (rovnaký `Stage` sa používa aj v náhľade)
- `archiv/` – staré jednorazové skripty a dokumentácia

Automatické spúšťanie po zapnutí: pozri [AUTOSTART.md](AUTOSTART.md).
