#!/bin/bash

tar -czf deploy.tar.gz --exclude='node_modules' --exclude='.git' .
scp deploy.tar.gz root@92.112.180.232:/var/www/blokeliai/
ssh root@92.112.180.232 "cd /var/www/blokeliai &&\
tar -xzf deploy.tar.gz && rm deploy.tar.gz"
rm deploy.tar.gz
ssh root@92.112.180.232 "chmod +x /var/www/blokeliai/scripts/refresh.sh"
ssh root@92.112.180.232 "/var/www/blokeliai/scripts/refresh.sh"
