#!/bin/bash

# Paprastesnis SSL setup - rankinis variantas
VPS_IP="72.62.1.133"
VPS_USER="root"

if [ -z "$1" ]; then
    echo "❌ Reikalingas email adresas"
    echo "Naudojimas: ./scripts/setup-ssl-simple.sh your-email@example.com"
    exit 1
fi

EMAIL="$1"

echo "🔒 SSL sertifikatų įdiegimas (paprastas variantas)..."
echo "📧 Email: $EMAIL"
echo ""
echo "📋 Instrukcijos:"
echo "1. Prisijunkite prie VPS:"
echo "   ssh $VPS_USER@$VPS_IP"
echo ""
echo "2. Įdiekite certbot (jei nėra):"
echo "   apt update && apt install -y certbot python3-certbot-nginx"
echo ""
echo "3. Gauti SSL sertifikatus:"
echo "   certbot --nginx -d pingpong.spensor.cloud --non-interactive --agree-tos --email $EMAIL --redirect"
echo "   certbot --nginx -d lightfest.spensor.cloud --non-interactive --agree-tos --email $EMAIL --redirect"
echo ""
echo "4. Patikrinkite:"
echo "   nginx -t && systemctl reload nginx"
echo ""
echo "🌐 Po įdiegimo:"
echo "   https://pingpong.spensor.cloud"
echo "   https://lightfest.spensor.cloud"

