# GitHub Proxy Server - Návod

## 🎯 Účel

Tento proxy server umožňuje používať TVDisplay aplikáciu bez nutnosti zadávať GitHub token na každom zariadení. Token je uložený na serveri a všetky zariadenia v sieti môžu používať admin panel bez toho, aby mali priamy prístup k tokenu.

## 📋 Výhody

✅ **Jedno miesto pre token** - GitHub token sa zadáva iba raz pri nastavení servera  
✅ **Jednoduchšie prihlásenie** - Na zariadeniach stačí zadať iba heslo  
✅ **Bezpečnejšie** - Token nie je uložený v prehliadači každého zariadenia  
✅ **Centrálna správa** - Všetky zmeny idú cez jeden server  

## 🚀 Inštalácia

### 1. Spustite setup skript:

```bash
chmod +x setup_proxy.sh
./setup_proxy.sh
```

Skript sa vás opýta na:
- **GitHub Token** - vytvorte ho na https://github.com/settings/tokens (potrebné oprávnenie "repo")
- **GitHub Owner** - vaše GitHub užívateľské meno (default: JanKarajos)
- **GitHub Repo** - názov repozitára (default: tvdisplay)

### 2. Overte konfiguráciu:

Skontrolujte súbor `.env`:
```bash
cat .env
```

### 3. Nainštalujte závislosti (ak ich setup neinštaloval):

```bash
npm install
```

### 4. Spustite aplikáciu s proxy serverom:

```bash
npm run start:all
```

Tento príkaz spustí:
- Vite dev server na porte 5173 (frontend)
- GitHub proxy server na porte 3001 (backend)

## 🔧 Automatické spúšťanie

Pre automatické spúšťanie pri štarte systému:

```bash
./install_service.sh
```

Systemd služba automaticky spustí oba servery (frontend + proxy).

## 🌐 Používanie

### Admin Panel

Po spustení servera prejdite na:
- `http://<IP_ADRESA>:5173/admin`

Pri prihlásení:
- **Heslo**: `admin123` (rovnaké ako predtým)
- **GitHub Token**: NIE JE potrebný! ✅

Token je automaticky poskytnutý proxy serverom.

### Testovacie endpointy

Overte, že proxy server beží:
```bash
curl http://localhost:3001/health
```

Odpoveď by mala obsahovať:
```json
{
  "status": "ok",
  "github": {
    "owner": "JanKarajos",
    "repo": "tvdisplay",
    "branch": "main",
    "tokenConfigured": true
  }
}
```

## 📝 Konfigurácia

### Environment premenné (.env)

```env
# GitHub Personal Access Token s oprávnením "repo"
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# GitHub repository konfigurácia
GITHUB_OWNER=JanKarajos
GITHUB_REPO=tvdisplay
GITHUB_BRANCH=main

# Port proxy servera
PORT=3001
```

### Zmena portu

Ak chcete zmeniť port proxy servera, upravte v `.env`:
```env
PORT=8080
```

## 🔒 Bezpečnosť

### Dôležité upozornenia

1. **Súbor .env obsahuje citlivé údaje** - neposkytujte ho nikomu!
2. **Pridajte .env do .gitignore** - nikdy ho necommitujte do Git!
3. **Proxy server by mal bežať iba v lokálnej sieti** - neotvárajte port navonok!

### Pridanie .env do .gitignore

```bash
echo ".env" >> .gitignore
```

### Firewall pravidlá

Ak používate firewall, povoľte iba lokálny prístup:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow from 192.168.0.0/16 to any port 3001
sudo ufw allow from 192.168.0.0/16 to any port 5173

# Alebo iba pre konkrétnu sieť
sudo ufw allow from 192.168.68.0/24 to any port 3001
sudo ufw allow from 192.168.68.0/24 to any port 5173
```

## 🐛 Riešenie problémov

### Proxy server sa nespustí

1. Skontrolujte logy:
```bash
sudo journalctl -u tvdisplay -f
```

2. Overte, že .env existuje a obsahuje token:
```bash
cat .env | grep GITHUB_TOKEN
```

3. Skúste spustiť manuálne:
```bash
npm run server
```

### Admin panel požaduje token

Znamená to, že proxy server nebeží alebo nie je dostupný. Skontrolujte:

```bash
# Overte, že proxy beží
curl http://localhost:3001/health

# Skontrolujte, či je port 3001 otvorený
netstat -tuln | grep 3001
```

### GitHub API chyby

1. Overte, že token má správne oprávnenia:
   - Prejdite na https://github.com/settings/tokens
   - Token musí mať zaškrtnuté: `repo` (Full control of private repositories)

2. Overte, že token nie je expirovaný

3. Skúste token manuálne:
```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/JanKarajos/tvdisplay/contents/songs.json
```

## 📊 Architektúra

```
┌─────────────────┐
│   Browser       │
│  (Admin Panel)  │
└────────┬────────┘
         │
         │ HTTP (port 5173)
         │
┌────────▼────────┐
│  Vite Server    │
│   (Frontend)    │
└────────┬────────┘
         │
         │ Proxy requests
         │ (port 3001)
         │
┌────────▼────────┐
│  GitHub Proxy   │
│     Server      │
└────────┬────────┘
         │
         │ GitHub API
         │ (with token)
         │
┌────────▼────────┐
│   GitHub.com    │
│   Repository    │
└─────────────────┘
```

## 🔄 Aktualizácia tokenu

Ak potrebujete zmeniť GitHub token:

1. Upravte `.env` súbor:
```bash
nano .env
```

2. Zmeňte hodnotu `GITHUB_TOKEN`

3. Reštartujte službu:
```bash
sudo systemctl restart tvdisplay
```

Alebo ak beží manuálne, zastavte a znovu spustite:
```bash
# Ctrl+C na zastavenie
npm run start:all
```

## 📚 Ďalšie zdroje

- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Express.js dokumentácia](https://expressjs.com/)
- [systemd dokumentácia](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
