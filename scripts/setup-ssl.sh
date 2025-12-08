#!/bin/bash

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env.sh"

# Check if sshpass is needed
if [ -n "$VPS_PASSWORD" ] && ! command -v sshpass &> /dev/null; then
    echo "📦 Įdiegiamas sshpass..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenko/sshpass/sshpass 2>/dev/null || echo "⚠️  Instaliuokite: brew install hudochenko/sshpass/sshpass"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install -y sshpass 2>/dev/null || sudo yum install -y sshpass 2>/dev/null || echo "⚠️  Įdiekite sshpass rankiniu būdu"
    fi
fi

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
    echo "Naudojimas: ./scripts/setup-ssl.sh your-email@example.com"
    exit 1
fi

EMAIL="$1"

echo "🔒 SSL sertifikatų įdiegimas..."
echo "📧 Email: $EMAIL"
echo "📡 VPS: $VPS_USER@$VPS_IP"
echo ""

eval "$SSH_PREFIX -o ConnectTimeout=10 \"$VPS_USER@$VPS_IP\" bash" << 'SSL_SETUP'
    # Įdiegti certbot jei nėra
    if ! command -v certbot &> /dev/null; then
        echo "📦 Įdiegiamas certbot..."
        apt update && apt install -y certbot python3-certbot-nginx
    fi

    # Patikrinti, ar nginx veikia
    if ! systemctl is-active --quiet nginx; then
        echo "⚠️  Nginx neveikia. Paleidžiamas..."
        systemctl start nginx
    fi

    # Sukurti HTTP konfigūraciją pirmiausia (certbot reikia)
    cat > /etc/nginx/sites-available/multi-site-temp.conf << 'EOF'
# Laikina HTTP konfigūracija SSL sertifikatų gavimui

server {
    listen 80;
    server_name pingpong.spensor.cloud;

    location / {
        proxy_pass http://localhost:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name lightfest.spensor.cloud;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # Įjungti laikiną konfigūraciją
    rm -f /etc/nginx/sites-enabled/multi-site.conf
    ln -sf /etc/nginx/sites-available/multi-site-temp.conf /etc/nginx/sites-enabled/multi-site-temp.conf
    nginx -t && systemctl reload nginx

    echo "✅ Laikina HTTP konfigūracija įdiegta"
    echo ""

    # Gauti SSL sertifikatus
    echo "🔒 Gaunami SSL sertifikatai..."
    
    # Ping Pong subdomenas
    echo "📋 Ping Pong sertifikatas..."
    timeout 120 certbot certonly --nginx -d pingpong.spensor.cloud --non-interactive --agree-tos --email $EMAIL --no-eff-email 2>&1 | tail -5 || echo "⚠️  Ping Pong sertifikatas nepavyko"
    
    # Light Fest subdomenas  
    echo "📋 Light Fest sertifikatas..."
    timeout 120 certbot certonly --nginx -d lightfest.spensor.cloud --non-interactive --agree-tos --email $EMAIL --no-eff-email 2>&1 | tail -5 || echo "⚠️  Light Fest sertifikatas nepavyko"
    
    # Atnaujinti nginx konfigūraciją su SSL redirect
    echo "🔧 Atnaujinama nginx konfigūracija..."
    
    # Ping Pong SSL konfigūracija
    if [ -f /etc/letsencrypt/live/pingpong.spensor.cloud/fullchain.pem ]; then
        certbot --nginx -d pingpong.spensor.cloud --non-interactive --redirect || echo "⚠️  Ping Pong SSL konfigūracija nepavyko"
    fi
    
    # Light Fest SSL konfigūracija
    if [ -f /etc/letsencrypt/live/lightfest.spensor.cloud/fullchain.pem ]; then
        certbot --nginx -d lightfest.spensor.cloud --non-interactive --redirect || echo "⚠️  Light Fest SSL konfigūracija nepavyko"
    fi
    
    echo ""
    echo "✅ SSL sertifikatai gauti!"
    
    # Patikrinti nginx konfigūraciją
    echo "🔧 Tikrinama nginx konfigūracija..."
    nginx -t
    if [ $? -eq 0 ]; then
        systemctl reload nginx
        echo "✅ Nginx atnaujintas su SSL"
    else
        echo "❌ Nginx konfigūracijos klaida"
    fi
    
    # Pašalinti laikiną konfigūraciją
    rm -f /etc/nginx/sites-enabled/multi-site-temp.conf
    
    # Patikrinti sertifikatų galiojimą
    echo ""
    echo "📋 Sertifikatų informacija:"
    certbot certificates
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

