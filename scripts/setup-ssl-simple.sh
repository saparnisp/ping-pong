#!/bin/bash

# Paprastas SSL įdiegimas su certbot
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env.sh"

# Build SSH command prefix
if [ -n "$SSH_KEY_PATH" ] && [ -f "$SSH_KEY_PATH" ]; then
    SSH_PREFIX="ssh -i \"$SSH_KEY_PATH\" -o StrictHostKeyChecking=no"
elif [ -n "$VPS_PASSWORD" ] && command -v sshpass &> /dev/null; then
    SSH_PREFIX="sshpass -p \"$VPS_PASSWORD\" ssh -o StrictHostKeyChecking=no"
else
    SSH_PREFIX="ssh -o StrictHostKeyChecking=no"
fi

# Patikrinti, ar pateiktas email
if [ -z "$1" ]; then
    echo "❌ Reikalingas email adresas"
    echo "Naudojimas: ./scripts/setup-ssl-simple.sh your-email@example.com"
    exit 1
fi

EMAIL="$1"

echo "🔒 SSL sertifikatų įdiegimas..."
echo "📧 Email: $EMAIL"
echo "📡 VPS: $VPS_USER@$VPS_IP"
echo ""

eval "$SSH_PREFIX \"$VPS_USER@$VPS_IP\" bash" << SSL_SETUP
    # Patikrinti certbot
    if ! command -v certbot &> /dev/null; then
        echo "📦 Įdiegiamas certbot..."
        apt update && apt install -y certbot python3-certbot-nginx
    fi
    
    # Patikrinti, ar nginx veikia
    if ! systemctl is-active --quiet nginx; then
        echo "⚠️  Nginx neveikia. Paleidžiamas..."
        systemctl start nginx
    fi
    
    echo "🔒 Gaunami SSL sertifikatai su certbot --nginx..."
    echo ""
    
    # Ping Pong subdomenas
    echo "📋 Ping Pong sertifikatas..."
    certbot --nginx -d pingpong.spensor.cloud --non-interactive --agree-tos --email $EMAIL --no-eff-email --redirect 2>&1 | tail -10
    
    echo ""
    
    # Light Fest subdomenas  
    echo "📋 Light Fest sertifikatas..."
    certbot --nginx -d lightfest.spensor.cloud --non-interactive --agree-tos --email $EMAIL --no-eff-email --redirect 2>&1 | tail -10
    
    echo ""
    echo "✅ SSL sertifikatai gauti!"
    
    # Patikrinti nginx konfigūraciją
    echo "🔧 Tikrinama nginx konfigūracija..."
    nginx -t && systemctl reload nginx && echo "✅ Nginx atnaujintas su SSL"
    
    # Patikrinti sertifikatų galiojimą
    echo ""
    echo "📋 Sertifikatų informacija:"
    certbot certificates 2>&1 | head -20
SSL_SETUP

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SSL sertifikatai sėkmingai įdiegti!"
    echo "🌐 Ping Pong: https://pingpong.spensor.cloud"
    echo "🌐 Light Fest: https://lightfest.spensor.cloud"
    echo ""
    echo "💡 Sertifikatai bus automatiškai atnaujinami per certbot timer"
else
    echo ""
    echo "❌ Klaida įdiegiant SSL sertifikatus"
fi
