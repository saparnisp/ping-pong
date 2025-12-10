#!/bin/bash

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env.sh"

echo "🔧 Nginx multi-site setup..."
echo "📡 VPS: $VPS_USER@$VPS_IP"
echo ""

# Check if sshpass is needed
if [ -n "$VPS_PASSWORD" ] && ! command -v sshpass &> /dev/null; then
    echo "📦 Įdiegiamas sshpass (reikalingas password autentifikacijai)..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenko/sshpass/sshpass 2>/dev/null || echo "⚠️  Instaliuokite: brew install hudochenko/sshpass/sshpass"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install -y sshpass 2>/dev/null || sudo yum install -y sshpass 2>/dev/null || echo "⚠️  Įdiekite sshpass rankiniu būdu"
    fi
fi

# Build SSH command prefix
if [ -n "$SSH_KEY_PATH" ] && [ -f "$SSH_KEY_PATH" ]; then
    SSH_PREFIX="ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no"
elif [ -n "$VPS_PASSWORD" ] && command -v sshpass &> /dev/null; then
    SSH_PREFIX="sshpass -p \"$VPS_PASSWORD\" ssh -o StrictHostKeyChecking=no"
else
    SSH_PREFIX="ssh -o StrictHostKeyChecking=no"
fi

eval "$SSH_PREFIX \"$VPS_USER@$VPS_IP\" bash" << 'NGINX_SETUP'
    # Įdiegti nginx jei nėra
    if ! command -v nginx &> /dev/null; then
        echo "📦 Įdiegiamas nginx..."
        apt update && apt install -y nginx
    fi

    # Sukurti katalogus jei nėra
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled

    # Sukurti nginx konfigūracijos failą
    cat > /etc/nginx/sites-available/multi-site.conf << 'EOF'
# Nginx konfigūracija abiem projektams

# Ping Pong projektas
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

# Light Fest projektas
server {
    listen 80;
    server_name lightfest.spensor.cloud;

    # Logs
    access_log /var/log/nginx/lightfest.access.log;
    error_log /var/log/nginx/lightfest.error.log;

    # Proxy settings
    location / {
        proxy_pass http://localhost:80;
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
}

# Default server - nukreipia į pingpong
server {
    listen 80 default_server;
    server_name _;

    return 301 http://pingpong.spensor.cloud$request_uri;
}
EOF

    echo "✅ Nginx konfigūracija sukurta"

    # Pašalinti senąsias konfigūracijas
    rm -f /etc/nginx/sites-enabled/pingpong.spensor.cloud
    rm -f /etc/nginx/sites-enabled/default

    # Įjungti naują konfigūraciją
    ln -sf /etc/nginx/sites-available/multi-site.conf /etc/nginx/sites-enabled/multi-site.conf
    echo "✅ Site įjungtas"

    # Patikrinti konfigūraciją
    nginx -t
    if [ $? -ne 0 ]; then
        echo "❌ Nginx konfigūracijos klaida"
        exit 1
    fi

    # Sustabdyti light_fest_web, kad nginx galėtų klausyti port 80
    echo "🛑 Sustabdome light_fest_web projektą..."
    docker ps --filter "name=light_fest" --format "{{.Names}}" | while read container; do
        docker stop "$container" 2>/dev/null && echo "   Sustabdytas: $container"
    done

    sleep 2

    # Patikrinti, ar Ping-pong aplikacija veikia
    echo "🔍 Tikrinamas Ping-pong konteineris..."
    if docker ps | grep -q blokeliai-app; then
        echo "✅ Ping-pong konteineris veikia"
        # Patikrinti, ar aplikacija atsako
        sleep 2
        if curl -f http://localhost:10000 > /dev/null 2>&1; then
            echo "✅ Aplikacija atsako port 10000"
        else
            echo "⚠️  Aplikacija neatsako port 10000 - gali būti 502 klaida"
            echo "   Patikrinkite: docker logs blokeliai-app"
        fi
    else
        echo "⚠️  Ping-pong konteineris neveikia!"
        echo "   Paleiskite: docker start blokeliai-app"
    fi

    # Paleisti nginx
    systemctl start nginx
    systemctl enable nginx
    echo "✅ Nginx paleistas"
    
    # Patikrinti nginx statusą
    sleep 1
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx veikia"
    else
        echo "❌ Nginx neveikia - patikrinkite: systemctl status nginx"
    fi
NGINX_SETUP

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Nginx multi-site konfigūracija sėkmingai įdiegta!"
    echo "🌐 Ping Pong: http://pingpong.spensor.cloud"
    echo "🌐 Light Fest: http://lightfest.spensor.cloud"
else
    echo ""
    echo "❌ Klaida įdiegiant nginx konfigūraciją"
fi

