#!/bin/bash

# Greitas patikrinimas
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env.sh"

# Build SSH command
if [ -n "$SSH_KEY_PATH" ] && [ -f "$SSH_KEY_PATH" ]; then
    SSH_CMD="ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no -o ConnectTimeout=5"
elif [ -n "$VPS_PASSWORD" ] && command -v sshpass &> /dev/null; then
    SSH_CMD="sshpass -p \"$VPS_PASSWORD\" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5"
else
    SSH_CMD="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5"
fi

echo "🔍 Greitas patikrinimas..."
echo ""

# Quick checks
eval "$SSH_CMD \"$VPS_USER@$VPS_IP\" \"docker ps | grep blokeliai; echo '---'; curl -s http://localhost:10000 | head -1; echo '---'; ls -la /etc/nginx/sites-enabled/ | grep multi\"" 2>&1

