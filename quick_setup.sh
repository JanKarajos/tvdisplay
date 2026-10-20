#!/bin/bash

# Rýchly setup pre proxy server s GitHub tokenom z argumentu

if [ -z "$1" ]; then
    echo "❌ Chyba: GitHub token nie je zadaný!"
    echo ""
    echo "Použitie:"
    echo "  ./quick_setup.sh <GITHUB_TOKEN>"
    echo ""
    echo "Príklad:"
    echo "  ./quick_setup.sh ghp_xxxxxxxxxxxxxxxxxxxxx"
    echo ""
    echo "Kde získať token:"
    echo "  https://github.com/settings/tokens"
    echo "  Potrebné oprávnenie: 'repo'"
    exit 1
fi

GITHUB_TOKEN=$1
GITHUB_OWNER=${2:-JanKarajos}
GITHUB_REPO=${3:-tvdisplay}

echo "🔧 Nastavujem GitHub proxy server..."
echo ""

# Vytvor .env súbor
cat > .env << EOF
# Environment premenné pre GitHub Proxy Server

# GitHub Personal Access Token s oprávnením "repo"
GITHUB_TOKEN=${GITHUB_TOKEN}

# GitHub repository konfigurácia
GITHUB_OWNER=${GITHUB_OWNER}
GITHUB_REPO=${GITHUB_REPO}
GITHUB_BRANCH=main

# Port na ktorom beží proxy server
PORT=3001
EOF

echo "✅ Súbor .env bol vytvorený!"
echo ""
echo "📦 Inštalujem npm závislosti..."
npm install

echo ""
echo "✨ Nastavenie dokončené!"
echo ""
echo "📝 Konfigurácia:"
echo "   GitHub Owner: ${GITHUB_OWNER}"
echo "   GitHub Repo:  ${GITHUB_REPO}"
echo "   Token:        ${GITHUB_TOKEN:0:10}..."
echo ""
echo "🚀 Spustite aplikáciu príkazom:"
echo "   npm run start:all"
echo ""
echo "Alebo nainštalujte systemd službu:"
echo "   ./install_service.sh"
echo ""
