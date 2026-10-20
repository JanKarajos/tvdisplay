#!/bin/bash

# Druhá inštancia tvdisplay (napr. pre testovanie), beží na inom porte.

PORT=5174

echo "🚀 Spúšťam druhú inštanciu tvdisplay aplikácie..."
echo ""

IP_ADDRESS=$(hostname -I | awk '{print $1}')
if [ -z "$IP_ADDRESS" ]; then
  echo "⚠️  Nepodarilo sa získať IP adresu"
  IP_ADDRESS="localhost"
fi

echo "📡 IP adresa zariadenia: $IP_ADDRESS"
echo "🌐 Druhá inštancia bude dostupná na:"
echo "   http://$IP_ADDRESS:$PORT"
echo "   http://localhost:$PORT"
echo ""
echo "🔗 Ovládanie (staré): http://$IP_ADDRESS:$PORT/#control-legacy"
echo "📺 Display stránka:  http://$IP_ADDRESS:$PORT/#display"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================"
echo ""

npm run start:alt
