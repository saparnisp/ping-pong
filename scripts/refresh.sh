#!/bin/bash

# npm install -g pm2
# ufw allow 'Nginx Full'
# ufw delete allow 'Nginx HTTP'
# yes | cp -rf /var/www/blokeliai/config/blokeliai.site /etc/nginx/sites-available/
# certbot --nginx -d blokeliai.site -d www.blokeliai.stie

cd /var/www/blokeliai
source ~/.nvm/nvm.sh;
npm install --production
chown -R root:root /var/www/blokeliai
chmod -R 755 /var/www/blokeliai
pm2 restart server