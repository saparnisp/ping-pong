#!/bin/bash

# Rankinis nginx setup - naudoja cat ir heredoc
# Nereikalauja scp, tik SSH

VPS_IP="72.62.1.133"
VPS_USER="root"

echo "🔧 Rankinis nginx setup..."
echo "📡 VPS: $VPS_USER@$VPS_IP"
echo ""

# Nginx konfigūracija per heredoc
ssh "$VPS_USER@$VPS_IP" << 'NGINX_CONFIG'
    # Įdiegti nginx jei nėra
    if ! command -v nginx &> /dev/null; then
        echo "📦 Įdiegiamas nginx..."
        apt update && apt install -y nginx
    fi

    # Sukurti katalogus jei nėra
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled

    # Sukurti nginx konfigūracijos failą
    cat > /etc/nginx/sites-available/pingpong.spensor.cloud << 'EOF'
server {
    listen 80;
    server_name pingpong.spensor.cloud;

    # Logs
    access_log /var/log/nginx/pingpong.access.log;
    error_log /var/log/nginx/pingpong.error.log;

    # Proxy settings
    location / {
        proxy_pass http://localhost:10000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:10000/;
        access_log off;
    }
}
EOF

    echo "✅ Nginx konfigūracija sukurta"

    # Įjungti site
    ln -sf /etc/nginx/sites-available/pingpong.spensor.cloud /etc/nginx/sites-enabled/pingpong.spensor.cloud
    echo "✅ Site įjungtas"

    # Patikrinti konfigūraciją
    nginx -t
    if [ $? -ne 0 ]; then
        echo "❌ Nginx konfigūracijos klaida"
        exit 1
    fi

    # Perkrauti nginx
    systemctl reload nginx
    echo "✅ Nginx perkrautas"
NGINX_CONFIG

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Nginx konfigūracija sėkmingai įdiegta!"
    echo "🌐 Patikrinkite: http://pingpong.spensor.cloud"
else
    echo ""
    echo "❌ Klaida įdiegiant nginx konfigūraciją"
fi

