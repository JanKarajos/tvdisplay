# 🔄 Real-time Synchronizácia medzi zariadeniami

## ✅ Hotovo!

Implementoval som kompletné riešenie pre **real-time synchronizáciu** medzi všetkými zariadeniami (telefón, PC, tablet, atď.).

## 🎯 Čo to robí

Keď:
- **Prepnete pieseň na telefóne** → zobrazí sa aj na PC a display
- **Zmeníte pozadie na PC** → zmení sa aj na telefóne
- **Skryjete text na jednom zariadení** → skryje sa na všetkých
- **Prepnete stranu piesne** → prepne sa všade

**Všetky zariadenia sú synchronizované v reálnom čase (cca 2 sekundy)!**

## 🏗️ Architektúra

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Telefón   │     │     PC      │     │   Display   │
│  (Chrome)   │     │  (Firefox)  │     │  (Browser)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                    │
       │    HTTP Polling (každé 2s)             │
       │                   │                    │
       └───────────────────┼────────────────────┘
                          │
                ┌─────────▼─────────┐
                │  State Server     │
                │  (Port 3002)      │
                │  state.json       │
                └───────────────────┘
```

## 📦 Nové komponenty

### 1. **State Server** (server/state-server.js)
- Beží na porte **3002**
- Ukladá stav do súboru `state.json`
- API endpoints:
  - `GET /api/state` - Načítaj stav
  - `POST /api/state` - Aktualizuj stav
  - `DELETE /api/state` - Reset stavu
  - `GET /health` - Health check

### 2. **Upravený useRealtime.js**
- Automaticky deteguje state server
- Polling každé 2 sekundy
- Fallback na localStorage ak server nie je dostupný

### 3. **Test stránka**
- `http://192.168.68.56:5173/test-sync.html`
- Živý náhľad synchronizácie
- Testovanie zmien stavu

## 🚀 Ako to funguje

### Automatická detekcia
Pri načítaní stránky sa automaticky:
1. Skontroluje dostupnosť state servera
2. Ak je dostupný → používa server sync
3. Ak nie je dostupný → fallback na localStorage (len medzi kartami)

### Real-time updates
- **Polling interval**: 2 sekundy
- Každé zariadenie sa pýta servera na nový stav
- Pri zmene stavu sa automaticky aktualizujú všetky zariadenia

### Zmena stavu
1. Zariadenie zmení stav (napr. prepne pieseň)
2. Stav sa odošle na server (POST /api/state)
3. Server uloží stav do `state.json`
4. Ostatné zariadenia dostanú nový stav pri ďalšom pollingu (max 2s)

## 🧪 Testovanie

### Test stránka
Otvorte na **dvoch rôznych zariadeniach**:
```
http://192.168.68.56:5173/test-sync.html
```

Skúste:
1. **Nastaviť pieseň** na jednom zariadení
2. **Sledovať zmenu** na druhom zariadení
3. **Toggle Hidden** na jednom → zmení sa na druhom

### Manuálny test
1. Otvorte ovládací panel na telefóne: `http://192.168.68.56:5173`
2. Otvorte display na PC: `http://192.168.68.56:5173/display`
3. Prepnite pieseň na telefóne
4. **Do 2 sekúnd** sa zmena zobrazí na PC!

### API test
```bash
# Získaj aktuálny stav
curl http://192.168.68.56:3002/api/state

# Nastav novú pieseň
curl -X POST http://192.168.68.56:3002/api/state \
  -H "Content-Type: application/json" \
  -d '{"currentSongId": "test-123"}'

# Reset stavu
curl -X DELETE http://192.168.68.56:3002/api/state

# Health check
curl http://192.168.68.56:3002/health
```

## 📊 Monitorovanie

### Konzola prehliadača
Otvorte DevTools → Console a uvidíte:
- `✅ State server je dostupný - používam server synchronizáciu`
- `[Realtime] Server state update: ...`
- `[Realtime] State sent to server`

### Server logy
```bash
# Sleduj logy state servera
sudo journalctl -u tvdisplay -f | grep "state-server\|State Server\|3002"

# Skontroluj stav služby
sudo systemctl status tvdisplay
```

### State súbor
```bash
# Zobraz aktuálny stav
cat /home/kari/Desktop/tvdisplay/state.json
```

## 🔧 Konfigurácia

### Port state servera
V `.env` súbore:
```env
STATE_PORT=3002
```

### Polling interval
V `useRealtime.js`, riadok cca 40:
```javascript
pollingInterval = setInterval(async () => {
  // ...
}, 2000);  // 2000ms = 2 sekundy
```

Môžete zmeniť na rýchlejšie (napr. 1000ms = 1s) alebo pomalšie (napr. 5000ms = 5s)

## 🐛 Riešenie problémov

### Synchronizácia nefunguje

1. **Overte, že state server beží:**
   ```bash
   curl http://192.168.68.56:3002/health
   ```
   
   Ak nefunguje:
   ```bash
   sudo systemctl restart tvdisplay
   ```

2. **Skontrolujte konzolu prehliadača:**
   - Hľadajte `State server je dostupný`
   - Alebo `State server nie je dostupný` (fallback na localStorage)

3. **Overte firewall:**
   ```bash
   sudo ufw allow 3002/tcp
   ```

### Synchronizácia je pomalá

- Defaultne polling každé 2 sekundy
- Upravte interval v `useRealtime.js` (riadok 40)
- Rýchlejší polling = viac CPU/network, ale okamžitejšie updates

### Stav sa resetuje

- State je uložený v `state.json`
- Pri reštarte servera sa zachováva
- Pri probléme vyčistite: `rm state.json` a reštartujte

## 📝 Súbory

- **server/state-server.js** - State server
- **src/hooks/useRealtime.js** - Real-time synchronizácia hook
- **state.json** - Uložený stav (vytvára sa automaticky)
- **test-sync.html** - Test stránka
- **.env** - Konfigurácia (STATE_PORT=3002)

## 🎉 Výsledok

**Pred:**
- ❌ Každé zariadenie malo vlastný stav
- ❌ Zmeny sa neprenášali medzi zariadeniami
- ❌ localStorage fungoval len v rovnakom prehliadači

**Po:**
- ✅ Všetky zariadenia zdieľajú jeden stav
- ✅ Zmeny sa synchronizujú automaticky (2s)
- ✅ Funguje medzi telefónom, PC, tabletom, atď.
- ✅ Fallback na localStorage ak server nie je dostupný

## 🔐 Bezpečnosť

- State server beží iba v lokálnej sieti
- Nepoužívajte verejne na internete
- Žiadna autentifikácia (vhodné len pre domácu sieť)

## 🚀 Ďalšie vylepšenia (voliteľné)

- **WebSockets** - okamžitá synchronizácia (bez pollingu)
- **Autentifikácia** - ochrana state servera
- **History** - história zmien stavu
- **Konfliktné riešenie** - pri súčasných zmenách

---

**Teraz môžete ovládať display z ktoréhokoľvek zariadenia a všetky sa automaticky synchronizujú! 🎉**
