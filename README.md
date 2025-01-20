# Blokeliai - Multiplayer Game Deployment Guide

## Deployment to Hostinger VPS

### Prerequisites
- Ubuntu VPS server (tested on Ubuntu 24.04)
- SSH access to your server
- Domain name (required for SSL)

### Step by Step Deployment

1. **Connect to Your Server**
```bash
ssh root@your-server-ip
```

2. **Update System and Install Dependencies**
```bash
# Update package list and upgrade existing packages
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Nginx
apt-get install -y nginx
```

3. **Create Application Directory**
```bash
mkdir -p /var/www/blokeliai
cd /var/www/blokeliai
```

4. **Upload Application Files**
From your local machine:
```bash
# Create deployment archive (exclude node_modules and .git)
tar -czf deploy.tar.gz --exclude='node_modules' --exclude='.git' .

# Upload to server
scp deploy.tar.gz root@your-server-ip:/var/www/blokeliai/
```

5. **Extract and Setup Application**
On the server:
```bash
cd /var/www/blokeliai
tar -xzf deploy.tar.gz
npm install --production

# Set proper permissions
chown -R root:root /var/www/blokeliai
chmod -R 755 /var/www/blokeliai
```

6. **Install and Configure PM2**
```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start server.js
pm2 save
pm2 startup
```

7. **Configure Nginx**
Create Nginx configuration file:
```bash
nano /etc/nginx/sites-available/blokeliai
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain-or-ip;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

8. **Enable Nginx Configuration**
```bash
# Create symlink
ln -s /etc/nginx/sites-available/blokeliai /etc/nginx/sites-enabled/

# Remove default config (optional)
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

### SSL Setup (Requires Domain Name)

> Note: Free SSL certificates from Let's Encrypt cannot be issued for IP addresses. You need a domain name.

Once you have a domain name pointing to your server:

1. **Install Certbot**
```bash
apt install -y certbot python3-certbot-nginx
```

2. **Get SSL Certificate**
```bash
certbot --nginx -d your-domain.com --non-interactive --agree-tos --email your-email@example.com
```

This will:
- Obtain SSL certificate
- Configure Nginx automatically
- Set up auto-renewal
- Redirect HTTP to HTTPS

3. **Verify Auto-Renewal**
```bash
systemctl status certbot.timer
```

### Managing Your Application

#### View Application Status
```bash
pm2 list
```

#### View Application Logs
```bash
pm2 logs server
```

#### Restart Application
```bash
pm2 restart server
```

#### View Nginx Status
```bash
systemctl status nginx
```

### Troubleshooting

1. **If the application fails to start:**
   - Check logs: `pm2 logs server`
   - Verify port availability: `netstat -tlpn | grep 3000`
   - Check Node.js version: `node --version`

2. **If Nginx returns 502 Bad Gateway:**
   - Check if Node.js application is running: `pm2 list`
   - Verify Nginx configuration: `nginx -t`
   - Check Nginx error logs: `cat /var/log/nginx/error.log`

3. **Permission Issues:**
   ```bash
   chown -R root:root /var/www/blokeliai
   chmod -R 755 /var/www/blokeliai
   ```

4. **SSL Issues:**
   - Make sure domain DNS is properly configured
   - Check Certbot logs: `journalctl -u certbot.service`
   - Verify certificate: `certbot certificates`

### Updating the Application

To update your application with new changes:

1. Create new deployment archive locally:
```bash
tar -czf deploy.tar.gz --exclude='node_modules' --exclude='.git' .
```

2. Upload and deploy:
```bash
# Upload new version
scp deploy.tar.gz root@your-server-ip:/var/www/blokeliai/

# On server
cd /var/www/blokeliai
tar -xzf deploy.tar.gz
npm install --production
pm2 restart server
```

Remember to replace `your-server-ip`, `your-domain.com`, and `your-email@example.com` with your actual values.
