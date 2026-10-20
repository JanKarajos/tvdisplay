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
- **PDF** sa nahrávajú na server do `uploads/`, v `songs.json` je iba odkaz.
- **Žalmy** sú v `Texty/Žalmy RRRR.json`. Nový rok stiahneš cez `node scripts/fetch_psalms_2027.js`.
- **PIN**: ak je v `.env` nastavený `CONTROL_PIN`, ovládanie si ho vypýta. Displej PIN nepotrebuje.

## Ovládanie klávesnicou

| Kláves | Akcia |
| --- | --- |
| → / PageDown | ďalšia strofa, na poslednej strofe pripravená ďalšia pieseň |
| ← / PageUp | predchádzajúca strofa |
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
