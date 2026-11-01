#!/bin/bash

# Setup skript pre GitHub proxy server

echo "🔧 Nastavenie GitHub proxy servera..."
echo ""

# Skontroluj či existuje .env súbor
if [ -f ".env" ]; then
    echo "⚠️  Súbor .env už existuje."
    read -p "Chcete ho prepísať? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Ponechávam existujúci .env súbor."
        exit 0
    fi
fi

# Vytvor .env zo šablóny
cp .env.example .env

echo "📝 Prosím, zadajte vaše GitHub údaje:"
echo ""

# Požiadaj o GitHub token
read -p "GitHub Token (s oprávnením 'repo'): " github_token
read -p "GitHub Owner (default: JanKarajos): " github_owner
github_owner=${github_owner:-JanKarajos}
read -p "GitHub Repo (default: tvdisplay): " github_repo
github_repo=${github_repo:-tvdisplay}

# Aktualizuj .env súbor
sed -i "s/GITHUB_TOKEN=.*/GITHUB_TOKEN=${github_token}/" .env
sed -i "s/GITHUB_OWNER=.*/GITHUB_OWNER=${github_owner}/" .env
sed -i "s/GITHUB_REPO=.*/GITHUB_REPO=${github_repo}/" .env

echo ""
echo "✅ Súbor .env bol vytvorený!"
echo ""
echo "📦 Inštalujem npm závislosti..."
npm install

echo ""
echo "✨ Nastavenie dokončené!"
echo ""
echo "🚀 Môžete spustiť server príkazom:"
echo "   npm run start:all"
echo ""
echo "Alebo nainštalujte systemd službu:"
echo "   ./install_service.sh"
echo ""
