# Blokeliai - Multiplayer Game Deployment Guide

## Quick Deployment

❗️ This is the way to deploy now

### Setup local key for the remote

```bash
ssh-copy-id root@92.112.180.232
```

### Setup ssh to use the key as identity:

Add this line to `~/ssh/config`:

> IdentityFile ~/.ssh/id_rsa

Congrats, now you can deploy by running:

```bash
npm run deploy
```

Quick steps for subsequent deployments:

```bash
# 1. Create and upload deployment archive
mkdir -p /tmp/blokeliai-deploy
tar -czf /tmp/blokeliai-deploy/deploy.tar.gz --exclude='node_modules' --exclude='.git' .
scp /tmp/blokeliai-deploy/deploy.tar.gz root@92.112.180.232:/var/www/blokeliai/

# 2. SSH into server and deploy
ssh root@92.112.180.232 "cd /var/www/blokeliai && tar -xzf deploy.tar.gz && npm install --production && pm2 restart server"

# 3. Verify deployment
ssh root@92.112.180.232 "pm2 status && systemctl status nginx | grep Active"
```

## Initial Server Setup (First Time Only)

### 1. Prerequisites

- Ubuntu VPS server (tested on Ubuntu 24.04)
- SSH access to your server
- Server IP: 92.112.180.232
- Node.js version 18.20.5
- npm version 10.8.2

### 2. Initial Server Setup

```bash
# Update system and install dependencies
ssh root@92.112.180.232 "apt update && apt upgrade -y && \
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
apt-get install -y nodejs nginx certbot python3-certbot-nginx"

# Create application directory
ssh root@92.112.180.232 "mkdir -p /var/www/blokeliai"
```

### 3. Application Files Setup

```bash
# Create deployment archive
mkdir -p /tmp/blokeliai-deploy
tar -czf /tmp/blokeliai-deploy/deploy.tar.gz --exclude='node_modules' --exclude='.git' .

# Upload to server
scp /tmp/blokeliai-deploy/deploy.tar.gz root@92.112.180.232:/var/www/blokeliai/

# Extract and install dependencies
ssh root@92.112.180.232 "cd /var/www/blokeliai && \
tar -xzf deploy.tar.gz && \
npm install --production && \
chown -R root:root /var/www/blokeliai && \
chmod -R 755 /var/www/blokeliai"
```

### 4. PM2 Setup

```bash
# Install and configure PM2
ssh root@92.112.180.232 "npm install -g pm2 && \
cd /var/www/blokeliai && \
NODE_ENV=production pm2 start server.js && \
pm2 save && \
pm2 startup"
```

### 5. Nginx Configuration

```bash
# Create Nginx configuration
ssh root@92.112.180.232 "yes | cp -rf /var/www/blokeliai/config/blokeliai /etc/nginx/sites-available/blokeliai"

# Enable site and restart Nginx
ssh root@92.112.180.232 "ln -sf /etc/nginx/sites-available/blokeliai /etc/nginx/sites-enabled/ && \
rm -f /etc/nginx/sites-enabled/default && \
nginx -t && \
systemctl restart nginx"
```

## File Structure

Important application files:

```
/var/www/blokeliai/
├── src/
│   ├── index.js         # Main application entry
│   ├── server/
│   │   ├── host.js      # Express server setup
│   │   ├── game/        # Game logic
│   │   └── socket/      # WebSocket handlers
│   └── public/          # Static files
├── server.js            # PM2 entry point
└── package.json         # Dependencies
```

## Managing the Application

### View Application Status

```bash
ssh root@92.112.180.232 "pm2 list"
```

### View Application Logs

```bash
ssh root@92.112.180.232 "pm2 logs server"
```

### Restart Application

```bash
ssh root@92.112.180.232 "pm2 restart server"
```

### View Nginx Status

```bash
ssh root@92.112.180.232 "systemctl status nginx"
```

## Troubleshooting

### 1. If the application fails to start:

```bash
# Check PM2 logs
ssh root@92.112.180.232 "pm2 logs server"

# Verify port availability
ssh root@92.112.180.232 "netstat -tlpn | grep 3000"

# Check Node.js version
ssh root@92.112.180.232 "node --version"
```

### 2. If Nginx returns 502 Bad Gateway:

```bash
# Check if Node.js app is running
ssh root@92.112.180.232 "pm2 list"

# Check Nginx config
ssh root@92.112.180.232 "nginx -t"

# Check Nginx logs
ssh root@92.112.180.232 "tail -f /var/log/nginx/error.log"
```

### 3. Permission Issues:

```bash
ssh root@92.112.180.232 "chown -R root:root /var/www/blokeliai && \
chmod -R 755 /var/www/blokeliai"
```

## Adding SSL (When You Have a Domain)

1. Register a domain and point it to 92.112.180.232
2. Install Certbot:

```bash
ssh root@92.112.180.232 "apt install -y certbot python3-certbot-nginx"
```

3. Get SSL certificate (replace your-domain.com):

```bash
ssh root@92.112.180.232 "certbot --nginx -d your-domain.com --non-interactive --agree-tos --email your-email@example.com"
```

## Development Notes

- The application runs on Node.js 18.20.5
- Uses PM2 for process management
- Nginx as reverse proxy
- WebSocket connections are supported and configured
- Application runs on port 3000 internally
