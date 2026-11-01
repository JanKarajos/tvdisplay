#!/bin/bash

# Skript pre odinštalovanie systemd služby pre tvdisplay aplikáciu

echo "🗑️  Odinštalovanie tvdisplay služby..."
echo ""

# Zastav službu
echo "⏹️  Zastavujem službu..."
sudo systemctl stop tvdisplay.service

# Vypni autostart
echo "🔌 Vypínam autostart..."
sudo systemctl disable tvdisplay.service

# Vymaž service súbor
echo "🗑️  Odstraňujem service súbor..."
sudo rm -f /etc/systemd/system/tvdisplay.service

# Reload systemd
echo "🔄 Reloadujem systemd..."
sudo systemctl daemon-reload

echo ""
echo "✅ Odinštalovanie dokončené!"
echo ""
echo "Služba tvdisplay bola odstránená."
echo "Súbory aplikácie zostali zachované."
echo ""
