# Automatické spúšťanie aplikácie Laudate

Tento návod popisuje, ako nastaviť automatické spúšťanie aplikácie po zapnutí zariadenia.

## 📋 Prerekvizity

- Systém s systemd (Linux)
- Nainštalovaný Node.js a npm
- Aplikácia v `/home/kari/Desktop/tvdisplay`

## 🚀 Inštalácia automatického spúšťania

### 1. Spustite inštalačný skript:

```bash
./install_service.sh
```

Tento skript automaticky:
- Skontroluje a nainštaluje npm závislosti
- Nakopíruje systemd service súbor do systému
- Zapne automatické spúšťanie pri štarte
- Spustí službu

### 2. Overenie, že služba beží:

```bash
sudo systemctl status tvdisplay
```

## 🌐 Prístup k aplikácii

Po spustení služby bude aplikácia dostupná na IP adrese zariadenia na porte 5173:

- **Displej**: `http://<IP_ADRESA>:5173/#display`
- **Ovládanie**: `http://<IP_ADRESA>:5173/#control`

Zistite IP adresu zariadenia príkazom:
```bash
hostname -I
```

## 📝 Užitočné príkazy

```bash
# Zobraziť stav služby
sudo systemctl status tvdisplay

# Zastaviť službu
sudo systemctl stop tvdisplay

# Spustiť službu
sudo systemctl start tvdisplay

# Reštartovať službu
sudo systemctl restart tvdisplay

# Vypnúť automatické spúšťanie
sudo systemctl disable tvdisplay

# Zapnúť automatické spúšťanie
sudo systemctl enable tvdisplay

# Zobraziť logy služby
sudo journalctl -u tvdisplay -f

# Zobraziť posledných 100 riadkov logov
sudo journalctl -u tvdisplay -n 100
```

## 🗑️ Odinštalovanie

Pre odstránenie automatického spúšťania spustite:

```bash
./uninstall_service.sh
```

Tento skript:
- Zastaví službu
- Vypne automatické spúšťanie
- Odstráni systemd service súbor
- Súbory aplikácie zostanú zachované

## 🔧 Manuálna konfigurácia

Ak potrebujete upraviť service súbor, môžete ho nájsť na:
- Lokálne: `./tvdisplay.service`
- V systéme: `/etc/systemd/system/tvdisplay.service`

Po úprave service súboru v systéme nezabudnite reloadnúť systemd:

```bash
sudo systemctl daemon-reload
sudo systemctl restart tvdisplay
```

## 🐛 Riešenie problémov

### Služba sa nespustí

1. Skontrolujte logy:
   ```bash
   sudo journalctl -u tvdisplay -n 50
   ```

2. Overte, že sú nainštalované závislosti:
   ```bash
   cd /home/kari/Desktop/tvdisplay
   npm install
   ```

3. Otestujte manuálne spustenie:
   ```bash
   npm run prod
   ```

### Aplikácia nie je dostupná na IP adrese

1. Skontrolujte, či aplikácia beží:
   ```bash
   sudo systemctl status tvdisplay
   ```

2. Overte, že firewall neblokuje port 5173:
   ```bash
   sudo ufw status
   # Ak je potrebné, povoľte port:
   sudo ufw allow 5173/tcp
   ```

3. Skontrolujte IP adresu:
   ```bash
   hostname -I
   ```

## 📱 Použitie na Raspberry Pi

Tento systém je ideálny pre Raspberry Pi, ktoré sa používa ako display zariadenie:

1. Nainštalujte službu pomocou `./install_service.sh`
2. Zariadenie sa automaticky pripojí k aplikácii pri štarte
3. Otvorte webový prehliadač v kiosk režime na display stránku
4. Na inom zariadení v sieti môžete ovládať cez admin panel

## ⚙️ Prispôsobenie

Ak chcete zmeniť nastavenia (napr. port), upravte súbor [vite.config.mjs](vite.config.mjs).
