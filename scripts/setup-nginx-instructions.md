# Nginx Setup Instrukcijos

## Problema
Subdomenas `pingpong.spensor.cloud` rodo Light Fest projektą vietoj blokeliai-app projekto.

## Sprendimas

### 1. Prisijunkite prie VPS
```bash
ssh root@72.62.1.133
```

### 2. Patikrinkite, ar nginx įdiegtas
```bash
nginx -v
# Jei nėra:
apt update && apt install -y nginx
```

### 3. Nukopijuokite nginx konfigūraciją

**Iš lokalaus kompiuterio:**
```bash
scp config/pingpong.spensor.cloud root@72.62.1.133:/etc/nginx/sites-available/
```

**Arba sukurkite rankiniu būdu VPS serveryje:**
```bash
nano /etc/nginx/sites-available/pingpong.spensor.cloud
```

Įdėkite šį turinį:
```nginx
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
```

### 4. Įjunkite site
```bash
ln -sf /etc/nginx/sites-available/pingpong.spensor.cloud /etc/nginx/sites-enabled/
```

### 5. Patikrinkite nginx konfigūraciją
```bash
nginx -t
```

### 6. Perkraukite nginx
```bash
systemctl reload nginx
```

### 7. Patikrinkite, ar veikia
```bash
curl http://pingpong.spensor.cloud
# Arba atidarykite naršyklėje: http://pingpong.spensor.cloud
```

## Troubleshooting

### Jei vis dar rodo Light Fest:
1. Patikrinkite, ar blokeliai-app konteineris veikia:
   ```bash
   docker ps | grep blokeliai
   ```

2. Patikrinkite, ar port 10000 teisingas:
   ```bash
   netstat -tlnp | grep 10000
   ```

3. Patikrinkite nginx logus:
   ```bash
   tail -f /var/log/nginx/pingpong.error.log
   tail -f /var/log/nginx/pingpong.access.log
   ```

4. Patikrinkite, ar nginx naudoja teisingą konfigūraciją:
   ```bash
   nginx -T | grep pingpong
   ```

