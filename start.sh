#!/bin/bash
# Zostaví aplikáciu a spustí server (API + ovládanie + displej)

IP_ADDRESS=$(hostname -I 2>/dev/null | awk '{print $1}')
IP_ADDRESS=${IP_ADDRESS:-localhost}

echo "🚀 Spúšťam tvdisplay…"
echo "⚙️  Ovládanie: http://$IP_ADDRESS:5173/#control"
echo "📺 Displej:   http://$IP_ADDRESS:5173/#display"
echo ""

npm run prod
