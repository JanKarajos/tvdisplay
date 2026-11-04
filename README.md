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
Voľby: `--yes`, `--no-kiosk` (bez obrazovky na TV), `--no-powerpoint` (bez LibreOffice),
`--nas-url=…` (piesne na NAS, pozri nižšie), `--church-url=ADRESA` (administrácia kostolov).

## Piesne, fotky a prezentácie na NAS (Synology)

Aplikácia beží na Orange Pi, na NAS je iba priečinok s dátami: `songs.json`, `images.json` a `media/`
(fotky a PDF prezentácie). Upravuje sa ako doteraz v ovládaní (záložka **Obsah**, chránená PIN-om),
zmeny sa ukladajú na NAS namiesto GitHubu.

- Orange Pi má kópiu dát u seba, takže TV aj ovládanie fungujú, aj keď NAS alebo internet nie je dostupný.
  Zmeny urobené bez spojenia sa na NAS nahrajú, keď sa spojenie obnoví.
- Každú minútu kontroluje zmeny na NAS – viac Orange Pi s tým istým priečinkom (napr. v jednom kostole) vidí
  tie isté piesne. Každý kostol môže mať na NAS svoj podpriečinok.
- Pri prvom spustení s prázdnym priečinkom sa naň nahrajú piesne, fotky a prezentácie, ktoré Orange Pi už má
  (celý spevník JKS aj vlastné úpravy).

### Nastavenie NAS (raz)

1. **Centrum balíkov** → nainštaluj **WebDAV Server**. V jeho nastaveniach zapni HTTP (port 5005) alebo HTTPS (port 5006).
2. **Ovládací panel → Zdieľaný priečinok** → vytvor priečinok `tvdisplay`.
3. **Ovládací panel → Používateľ** → vytvor používateľa napr. `tvdisplay`:
   - právo **Čítať/Zapisovať** iba na priečinok `tvdisplay`,
   - v časti **Aplikácie** povoľ **WebDAV**.
4. Adresa priečinka pre Orange Pi:
   - v tej istej sieti: `http://<IP-NAS>:5005/tvdisplay/<kostol>`, napr. `http://192.168.1.10:5005/tvdisplay/kostol-sv-martina`,
   - cez internet: `https://<adresa-NAS>:5006/tvdisplay/<kostol>`. Treba DDNS adresu (Ovládací panel → Externý prístup → DDNS),
     na routeri presmerovaný port 5006 na NAS a certifikát Let's Encrypt (Ovládací panel → Zabezpečenie → Certifikát).
     Cez internet používaj iba HTTPS, inak by heslo išlo nezašifrované.

Podpriečinok kostola netreba vytvárať, Orange Pi si ho vytvorí sám.

### Nastavenie Orange Pi

- **Nová inštalácia:** inštalátor sa opýta na adresu priečinka, meno a heslo.
- **Už nainštalované Orange Pi:**

```bash
sudo bash tvdisplay-orangepi-install.sh --nas-url=http://192.168.1.10:5005/tvdisplay/kostol-sv-martina --nas-user=tvdisplay --nas-password=HESLO
```

Pri HTTPS s certifikátom, ktorý vystavil samotný NAS (nie Let's Encrypt), pridaj `--nas-ignore-cert`.
Stav spojenia s NAS je v ovládaní v záložke **Obsah → Synchronizácia**.
Napojenie zrušíš voľbou `--nas-url=` (prázdna adresa); piesne sa potom znova berú z GitHubu.

## Alternatíva: administrácia kostolov s prihlasovaním (Docker na NAS)

Centrálna stránka s prihlásením, kde sa spravujú piesne, kategórie, obrázky a prezentácie viacerých kostolov.

- **Administrátor** vytvára kostoly a používateľov a môže upravovať obsah všetkých kostolov.
- **Editor** má priradený jeden kostol a vidí iba ten.
- Každý kostol má **vlastné piesne**. Nový kostol dostane kópiu celého spevníka JKS, ktorú potom môže ľubovoľne meniť.
  Tlačidlo **Doplniť piesne JKS** (záložka Kostoly) pridá do všetkých kostolov piesne JKS, ktoré im chýbajú;
  piesne, ktoré kostol už má (aj upravené), sa neprepíšu.
- Orange Pi v kostole si dáta svojho kostola sťahuje z administrácie každú minútu.
  Má ich uložené aj u seba, takže funguje aj bez internetu.
  Zmena v administrácii sa na TV aj v ovládaní prejaví sama, bez obnovenia stránky.

### Inštalácia na NAS

1. V Centre balíkov nainštaluj **Container Manager**.
2. Stiahni tento repozitár (GitHub → *Code* → *Download ZIP*) a cez File Station ho rozbaľ, napr. do `/docker/tvdisplay`.
3. V `docker-compose.yml` zmeň `ADMIN_PASSWORD`. Je to heslo prvého administrátora a použije sa iba pri prvom spustení.
4. Container Manager → **Projekt** → **Vytvoriť** → cesta `/docker/tvdisplay` → použiť existujúci `docker-compose.yml`.
   Prvé zostavenie trvá niekoľko minút.
5. Otvor `http://<IP-NAS>:8080` a prihlás sa ako `admin`. Potom:
   - zmeň si heslo (ikona 🔑),
   - v záložke **Kostoly** pridaj kostoly,
   - v záložke **Používatelia** vytvor editorov a priraď im kostol.

**Prístup z internetu** (pre editorov a pre Orange Pi v kostoloch):
1. Ovládací panel → Prihlasovací portál → Rozšírené → **Reverzný proxy server**.
2. Pridaj pravidlo z `https://<tvoja-adresa>:443` na `http://localhost:8080`.
3. Certifikát Let's Encrypt získaš v Ovládací panel → Zabezpečenie → Certifikát.

Používaj **HTTPS**, inak by heslá išli cez internet nezašifrované.
Na serveri administrácie je ovládanie TV vypnuté, nedá sa cez neho nič zobraziť ani zmeniť.

**Dáta** sú v priečinku `admin-data` vedľa `docker-compose.yml`. Zálohuj ho, napr. cez Hyper Backup.
Zmazané kostoly sa presúvajú do `admin-data/deleted/`.

**Zabudnuté heslo:**

```bash
docker exec -it tvdisplay-admin node server/set-password.js admin NoveHeslo123 --admin
```

**Aktualizácia:**
1. Nahraj nové súbory (priečinok `admin-data` nechaj tak).
2. V Container Manageri: Projekt → Akcia → **Zostaviť**.

PowerPoint sa na NAS na PDF neprevádza (v kontajneri nie je LibreOffice), nahrávaj prezentácie ako PDF.

### Napojenie Orange Pi na administráciu

V administrácii v záložke **Kostoly** skopíruj adresu kostola (napr. `https://mojnas.synology.me/api/public/churches/kostol-sv-martina`).

- **Nová inštalácia:** inštalátor sa na adresu opýta.
- **Už nainštalované Orange Pi:** spusti inštalátor s voľbou:

```bash
sudo bash tvdisplay-orangepi-install.sh --church-url=https://mojnas.synology.me/api/public/churches/kostol-sv-martina
```

V ovládaní sa potom piesne, obrázky a prezentácie neupravujú, záložka **Obsah** odkáže na administráciu.
Obrázky a prezentácie ostávajú v záložke Obsah, odkiaľ sa dajú pridať do poradia a nastaviť ako pozadie.
Napojenie zrušíš voľbou `--church-url=` (prázdna adresa); piesne sa potom znova berú z GitHubu.

Vývoj administrácie na počítači: `ADMIN_DATA_DIR=admin-data ADMIN_PASSWORD=heslo1234 npm run dev`, potom `http://localhost:5173/#admin`.

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
- **Kategórie** piesní zodpovedajú oddielom spevníka JKS podľa čísla piesne (adventné 1–33, vianočné 34–113, …,
  latinské 532–543), rozsahy sú v `server/jksCategories.js`. Po pridaní piesní s číslom JKS do `songs.json`
  ich zaradí `node scripts/categorize_jks.js`.
- **Žalmy** sú v `Texty/Žalmy RRRR.json`. Nový rok stiahneš cez `node scripts/fetch_psalms_2027.js`.
- **PIN**: ak je v `.env` nastavený `CONTROL_PIN`, ovládanie si ho vypýta. Displej PIN nepotrebuje.
- **Administrácia kostolov** (`ADMIN_DATA_DIR`) a **napojenie na ňu** (`CHURCH_DATA_URL`): pozri vyššie.

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
- `server/admin.js` – administrácia kostolov (prihlásenie, kostoly, používatelia, obsah)
- `server/churchSync.js` – Orange Pi: sťahovanie dát kostola z administrácie a ich kópia na disku
- `server/nasStorage.js` – Orange Pi: piesne, fotky a prezentácie v priečinku na NAS (WebDAV) a ich kópia na disku
- `src/admin/*` – stránka administrácie (`#admin`)
- `src/api/stateClient.js` – zdieľaný stav a pripojenie
- `src/api/api.js` – knižnica piesní, obrázkov, PDF a žalmov
- `src/pages/ControlPage.jsx`, `src/components/control/*` – ovládanie
- `src/pages/DisplayPage.jsx`, `src/components/Stage.jsx` – displej (rovnaký `Stage` sa používa aj v náhľade)
- `archiv/` – staré jednorazové skripty a dokumentácia

Automatické spúšťanie po zapnutí: pozri [AUTOSTART.md](AUTOSTART.md).
