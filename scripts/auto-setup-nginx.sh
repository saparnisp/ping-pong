#!/bin/bash

# Automatinis nginx setup skriptas
# Reikia SSH prieigos prie VPS

VPS_IP="72.62.1.133"
VPS_USER="root"
CONFIG_FILE="config/pingpong.spensor.cloud"
REMOTE_CONFIG="/etc/nginx/sites-available/pingpong.spensor.cloud"

echo "🔧 Automatinis nginx setup..."
echo "📡 VPS: $VPS_USER@$VPS_IP"
echo ""

# Patikrinti, ar config failas egzistuoja
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config failas nerastas: $CONFIG_FILE"
    exit 1
fi

# Įdiegti nginx konfigūraciją
echo "🔧 Įdiegiama nginx konfigūracija..."
ssh "$VPS_USER@$VPS_IP" << 'EOF'
    # Įdiegti nginx jei nėra
    if ! command -v nginx &> /dev/null; then
        echo "📦 Įdiegiamas nginx..."
        apt update && apt install -y nginx
    fi

    # Sukurti katalogus jei nėra
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled
    echo "✅ Katalogai sukurti"
EOF

if [ $? -ne 0 ]; then
    echo "❌ Nepavyko prisijungti prie VPS"
    echo "💡 Patikrinkite SSH prieigą: ssh $VPS_USER@$VPS_IP"
    exit 1
fi

# Nukopijuoti config failą
echo "📤 Kopijuojamas nginx config..."
scp "$CONFIG_FILE" "$VPS_USER@$VPS_IP:$REMOTE_CONFIG"

if [ $? -ne 0 ]; then
    echo "❌ Nepavyko nukopijuoti config failo"
    echo "💡 Patikrinkite SSH prieigą: ssh $VPS_USER@$VPS_IP"
    exit 1
fi

echo "✅ Config failas nukopijuotas"

# Įdiegti nginx konfigūraciją
echo "🔧 Konfigūruojamas nginx..."
ssh "$VPS_USER@$VPS_IP" << 'EOF'

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
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Nginx konfigūracija sėkmingai įdiegta!"
    echo "🌐 Patikrinkite: http://pingpong.spensor.cloud"
else
    echo ""
    echo "❌ Klaida įdiegiant nginx konfigūraciją"
    echo "💡 Patikrinkite instrukcijas: scripts/setup-nginx-instructions.md"
fi

