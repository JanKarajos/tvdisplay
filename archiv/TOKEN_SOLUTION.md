# 🎯 GitHub Token - Riešenie bez zadávania na každom zariadení

## ✅ Hotovo!

Vytvoril som kompletné riešenie, ktoré umožňuje používať GitHub token bez nutnosti zadávať ho na každom zariadení.

## 🏗️ Čo bolo vytvorené

### 1. **GitHub Proxy Server** 
   - [server/github-proxy.js](server/github-proxy.js) - Express server, ktorý sprostredkúva komunikáciu s GitHub API
   - Token je uložený iba na serveri, nie v každom prehliadači

### 2. **Environment Configuration**
   - [.env.example](.env.example) - Šablóna pre konfiguráciu
   - `.env` - Váš súkromný súbor s tokenom (necommituje sa do Git)

### 3. **Setup Skripty**
   - [setup_proxy.sh](setup_proxy.sh) - Interaktívny setup s otázkami
   - [quick_setup.sh](quick_setup.sh) - Rýchly setup s tokenom ako argumentom

### 4. **Aktualizovaná Admin Aplikácia**
   - [admin/app.js](admin/app.js) - Upravené na použitie proxy servera
   - Token sa už nepýta pri prihlásení (keď beží proxy)

### 5. **Dokumentácia**
   - [PROXY_SETUP.md](PROXY_SETUP.md) - Podrobný návod na nastavenie a používanie

## 🚀 Ako to použiť

### Rýchly štart (odporúčané):

```bash
./quick_setup.sh ghp_váš_github_token_tu
```

### Alebo interaktívne:

```bash
./setup_proxy.sh
```

### Potom spustite aplikáciu:

```bash
npm run start:all
```

Alebo nainštalujte ako systemd službu:

```bash
./install_service.sh
```

## 📱 Používanie na zariadeniach

Po spustení proxy servera:

1. **Na Raspberry Pi / serveri**:
   - Beží proxy server + frontend
   - Token je uložený v `.env` súbore

2. **Na ľubovoľnom zariadení v sieti**:
   - Otvorte: `http://<IP_SERVERA>:5173/admin`
   - Zadajte iba **heslo**: `admin123`
   - **Token NIE JE potrebný!** ✅

## 🔒 Bezpečnosť

- ✅ Token je uložený iba na serveri
- ✅ `.env` je v `.gitignore` (necommituje sa)
- ✅ Proxy server komunikuje s GitHub API s tokenom
- ✅ Zariadenia komunikujú iba s proxy serverom (bez tokenu)

## 📊 Architektúra

```
Zariadenie 1 (mobil)  ────┐
                          │
Zariadenie 2 (tablet) ────┼──► Proxy Server ──► GitHub API
                          │   (má token)       (s tokenom)
Zariadenie 3 (PC)     ────┘
```

## 🎉 Výsledok

- ❌ **Predtým**: Museli ste zadávať token na každom zariadení
- ✅ **Teraz**: Token zadáte raz pri nastavení servera
- ✅ Na zariadeniach stačí iba heslo!

## 📝 Ďalšie kroky

1. Získajte GitHub token: https://github.com/settings/tokens (s oprávnením "repo")
2. Spustite: `./quick_setup.sh <token>`
3. Nainštalujte službu: `./install_service.sh`
4. Otvorte admin na akomkoľvek zariadení: `http://<IP>:5173/admin`

---

Pre viac informácií pozrite [PROXY_SETUP.md](PROXY_SETUP.md)
