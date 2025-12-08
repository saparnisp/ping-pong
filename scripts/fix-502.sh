#!/bin/bash

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env.sh"

echo "🔧 502 Bad Gateway sprendimas..."
echo ""

echo "📋 Instrukcijos rankiniam sprendimui:"
echo ""
echo "1. Prisijunkite prie VPS:"
if [ -n "$SSH_KEY_PATH" ] && [ -f "$SSH_KEY_PATH" ]; then
    echo "   ssh -i $SSH_KEY_PATH $VPS_USER@$VPS_IP"
else
    echo "   ssh $VPS_USER@$VPS_IP"
fi
echo ""
echo "2. Patikrinkite Docker konteinerį:"
echo "   docker ps | grep blokeliai"
echo ""
echo "3. Jei konteineris neveikia, paleiskite jį:"
echo "   docker start blokeliai-app"
echo ""
echo "4. Patikrinkite, ar aplikacija veikia:"
echo "   curl http://localhost:10000"
echo ""
echo "5. Patikrinkite nginx konfigūraciją:"
echo "   nginx -t"
echo ""
echo "6. Perkraukite nginx:"
echo "   systemctl reload nginx"
echo ""
echo "7. Patikrinkite nginx logus:"
echo "   tail -f /var/log/nginx/pingpong.error.log"
echo ""

# Alternatyvus sprendimas - patikrinti per API
echo "💡 Arba patikrinkite projekto statusą:"
echo "   node scripts/check-status.js"

