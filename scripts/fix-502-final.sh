#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env.sh"

if [ -n "$SSH_KEY_PATH" ] && [ -f "$SSH_KEY_PATH" ]; then
    SSH_CMD="ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no"
elif [ -n "$VPS_PASSWORD" ] && command -v sshpass &> /dev/null; then
    SSH_CMD="sshpass -p \"$VPS_PASSWORD\" ssh -o StrictHostKeyChecking=no"
else
    SSH_CMD="ssh -o StrictHostKeyChecking=no"
fi

echo "🔧 Galutinis 502 sprendimas..."
echo ""

eval "$SSH_CMD \"$VPS_USER@$VPS_IP\" bash" << 'FIX'
    # 1. Sustabdyti light_fest_web
    echo "1. Sustabdome light_fest_web..."
    docker ps --filter "name=light_fest" --format "{{.Names}}" | while read container; do
        docker stop "$container" 2>/dev/null && echo "   ✅ Sustabdytas: $container"
    done
    
    # 2. Patikrinti nginx konfigūraciją
    echo ""
    echo "2. Tikrinama nginx konfigūracija..."
    if [ -f /etc/nginx/sites-enabled/multi-site.conf ]; then
        echo "   ✅ Konfigūracija rasta"
        # Patikrinti proxy_pass
        if grep -q "proxy_pass http://localhost:10000" /etc/nginx/sites-enabled/multi-site.conf; then
            echo "   ✅ proxy_pass teisingas"
        else
            echo "   ❌ proxy_pass neteisingas!"
            echo "   Konfigūracija:"
            grep "proxy_pass" /etc/nginx/sites-enabled/multi-site.conf
        fi
    else
        echo "   ❌ Konfigūracija nerasta!"
    fi
    
    # 3. Patikrinti port 80
    echo ""
    echo "3. Tikrinamas port 80..."
    PORT80=$(netstat -tlnp | grep :80 | head -1)
    if [ -n "$PORT80" ]; then
        echo "   Port 80: $PORT80"
        if echo "$PORT80" | grep -q nginx; then
            echo "   ✅ Nginx klauso port 80"
        else
            echo "   ⚠️  Port 80 užimtas kitu procesu"
        fi
    fi
    
    # 4. Perkrauti nginx
    echo ""
    echo "4. Perkraunamas nginx..."
    nginx -t && systemctl reload nginx && echo "   ✅ Nginx perkrautas"
    
    # 5. Patikrinti nginx logus
    echo ""
    echo "5. Paskutinės nginx klaidos:"
    tail -5 /var/log/nginx/pingpong.error.log 2>/dev/null || echo "   Log failas nerastas"
FIX

echo ""
echo "✅ Patikrinimas baigtas!"
echo "🌐 Patikrinkite: http://pingpong.spensor.cloud"


