npm install -g pm2
cd /var/www/blokeliai
tar -xzf deploy.tar.gz
npm install --production
chown -R root:root /var/www/blokeliai
chmod -R 755 /var/www/blokeliai
pm2 restart server