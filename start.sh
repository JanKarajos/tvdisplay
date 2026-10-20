#!/bin/bash

# Skript na automatické spustenie tvdisplay aplikácie na IP adrese zariadenia

echo "🚀 Spúšťam tvdisplay aplikáciu..."
echo ""

# Získaj IP adresu zariadenia
IP_ADDRESS=$(hostname -I | awk '{print $1}')

if [ -z "$IP_ADDRESS" ]; then
    echo "⚠️  Nepodarilo sa získať IP adresu"
    IP_ADDRESS="localhost"
fi

echo "📡 IP adresa zariadenia: $IP_ADDRESS"
echo "🌐 Aplikácia bude dostupná na:"
echo "   http://$IP_ADDRESS:5173"
echo "   http://localhost:5173"
echo ""
echo "📺 Display stránka: http://$IP_ADDRESS:5173"
echo "⚙️  Admin stránka: http://$IP_ADDRESS:5173/admin"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================"
echo ""

# Spusti aplikáciu
npm run start
