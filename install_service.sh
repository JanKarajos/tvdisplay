#!/bin/bash

# Skript pre inštaláciu systemd služby pre tvdisplay aplikáciu

echo "🔧 Inštalácia tvdisplay služby..."
echo ""

# Skontroluj či existuje service súbor
if [ ! -f "tvdisplay.service" ]; then
    echo "❌ Súbor tvdisplay.service nebol nájdený!"
    exit 1
fi

# Skontroluj či sú nainštalované závislosti
if [ ! -d "node_modules" ]; then
    echo "📦 Inštalujem npm závislosti..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Nepodarilo sa nainštalovať závislosti!"
        exit 1
    fi
fi

# Skopíruj service súbor do systemd
echo "📋 Kopírujem service súbor do /etc/systemd/system/..."
sudo cp tvdisplay.service /etc/systemd/system/

# Reload systemd
echo "🔄 Reloadujem systemd..."
sudo systemctl daemon-reload

# Zapni službu
echo "✅ Zapínam tvdisplay službu..."
sudo systemctl enable tvdisplay.service

# Spusti službu
echo "🚀 Spúšťam tvdisplay službu..."
sudo systemctl start tvdisplay.service

echo ""
echo "✨ Inštalácia dokončená!"
echo ""
echo "Užitočné príkazy:"
echo "  Stav služby:       sudo systemctl status tvdisplay"
echo "  Zastaviť službu:   sudo systemctl stop tvdisplay"
echo "  Reštartovať:       sudo systemctl restart tvdisplay"
echo "  Vypnúť autostart:  sudo systemctl disable tvdisplay"
echo "  Logy služby:       sudo journalctl -u tvdisplay -f"
echo ""

# Získaj IP adresu
IP_ADDRESS=$(hostname -I | awk '{print $1}')
if [ -z "$IP_ADDRESS" ]; then
    IP_ADDRESS="localhost"
fi

echo "🌐 Aplikácia je dostupná na:"
echo "   http://$IP_ADDRESS:5173"
echo "   Admin: http://$IP_ADDRESS:5173/admin"
echo ""
