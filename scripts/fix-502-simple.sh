#!/bin/bash

# Paprastas 502 sprendimas
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env.sh"

# Build SSH command
if [ -n "$SSH_KEY_PATH" ] && [ -f "$SSH_KEY_PATH" ]; then
    SSH_CMD="ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no"
elif [ -n "$VPS_PASSWORD" ] && command -v sshpass &> /dev/null; then
    SSH_CMD="sshpass -p \"$VPS_PASSWORD\" ssh -o StrictHostKeyChecking=no"
else
    SSH_CMD="ssh -o StrictHostKeyChecking=no"
fi

echo "🔧 Taisomas 502 Bad Gateway..."
echo ""

# Patikrinti ir pataisyti
eval "$SSH_CMD \"$VPS_USER@$VPS_IP\" bash" << 'FIX'
    echo "1. Patikrinamas Docker konteineris..."
    if docker ps | grep -q blokeliai-app; then
        echo "✅ Konteineris veikia"
    else
        echo "❌ Konteineris neveikia - paleidžiamas..."
        docker start blokeliai-app 2>/dev/null || echo "⚠️  Nepavyko paleisti"
    fi
    
    echo ""
    echo "2. Patikrinama aplikacija port 10000..."
    sleep 2
    if curl -f http://localhost:10000 > /dev/null 2>&1; then
        echo "✅ Aplikacija veikia"
    else
        echo "❌ Aplikacija neveikia"
        echo "   Logai:"
        docker logs --tail 5 blokeliai-app 2>&1 | head -5
    fi
    
    echo ""
    echo "3. Patikrinama nginx konfigūracija..."
    if [ -f /etc/nginx/sites-enabled/multi-site.conf ]; then
        echo "✅ Konfigūracija rasta"
        nginx -t && echo "✅ Konfigūracija teisinga" || echo "❌ Konfigūracijos klaida"
    else
        echo "❌ Konfigūracija nerasta - reikia įdiegti"
        exit 1
    fi
    
    echo ""
    echo "4. Perkraunamas nginx..."
    systemctl reload nginx
    echo "✅ Nginx perkrautas"
FIX

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Patikrinimas baigtas!"
    echo "🌐 Patikrinkite: http://pingpong.spensor.cloud"
fi

