#!/bin/bash

# 502 Bad Gateway debug skriptas
VPS_IP="72.62.1.133"
VPS_USER="root"

echo "🔍 502 Bad Gateway debug..."
echo ""

ssh "$VPS_USER@$VPS_IP" << 'DEBUG'
    echo "1. Docker konteineriai:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAME|blokeliai|10000"
    echo ""
    
    echo "2. Port 10000 tikrinimas:"
    netstat -tlnp | grep 10000 || ss -tlnp | grep 10000
    echo ""
    
    echo "3. Patikrinti, ar aplikacija veikia port 10000:"
    curl -I http://localhost:10000 2>&1 | head -5
    echo ""
    
    echo "4. Nginx error logai (paskutinės 20 eilučių):"
    tail -20 /var/log/nginx/pingpong.error.log 2>/dev/null || echo "Log failas nerastas"
    echo ""
    
    echo "5. Nginx konfigūracija (proxy_pass):"
    grep -A 2 "proxy_pass" /etc/nginx/sites-enabled/*.conf | grep -E "server_name|proxy_pass" | head -10
    echo ""
    
    echo "6. Nginx statusas:"
    systemctl status nginx --no-pager | head -5
    echo ""
    
    echo "7. Blokeliai-app konteinerio logai (paskutinės 10 eilučių):"
    docker logs --tail 10 blokeliai-app 2>&1 || echo "Konteineris nerastas"
DEBUG

