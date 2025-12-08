#!/bin/bash

# Nginx subdomain setup script for pingpong.spensor.cloud
# Run this script on your VPS server

echo "🔧 Nginx subdomain setup..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root"
    exit 1
fi

# Copy nginx config
CONFIG_FILE="/etc/nginx/sites-available/pingpong.spensor.cloud"
if [ -f "config/pingpong.spensor.cloud" ]; then
    cp config/pingpong.spensor.cloud $CONFIG_FILE
    echo "✅ Config file copied to $CONFIG_FILE"
else
    echo "❌ Config file not found: config/pingpong.spensor.cloud"
    exit 1
fi

# Enable site
ln -sf $CONFIG_FILE /etc/nginx/sites-enabled/pingpong.spensor.cloud
echo "✅ Site enabled"

# Test nginx config
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Nginx config test failed"
    exit 1
fi

# Reload nginx
systemctl reload nginx
echo "✅ Nginx reloaded"

# Check nginx status
systemctl status nginx --no-pager | head -5

echo ""
echo "🎉 Setup complete!"
echo "🌐 Subdomain: pingpong.spensor.cloud"
echo "📦 Proxy: http://localhost:10000"
echo ""
echo "⚠️  Make sure Docker container is running on port 10000"

