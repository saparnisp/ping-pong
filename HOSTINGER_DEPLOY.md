# Hostinger Deployment Dokumentacija

## Apžvalga

Šis projektas naudoja Hostinger VPS Docker Manager API automatizuotam deployinimui. Deployinimas vyksta per GitHub repository ir Hostinger API.

## Reikalavimai

1. **Hostinger VPS** su Docker įdiegtu
2. **Hostinger API Token** - gali gauti iš [hPanel API Tokens](https://hpanel.hostinger.com/profile/api)
3. **GitHub Repository** - projektas turi būti GitHub'e
4. **Node.js** - deploy skriptams

## Pirmas Kartas - Nustatymas

### 1. Gauti Hostinger API Token

1. Eikite į [Hostinger hPanel](https://hpanel.hostinger.com/profile/api)
2. Sukurkite naują API token
3. Nukopijuokite token

### 2. Nustatyti API Token

Sukurkite `.env` failą projekto šakniniame kataloge:

```bash
# .env
HOSTINGER_API_TOKEN=jūsų_api_token_čia
```

Arba nustatykite kaip environment variable:

```bash
export HOSTINGER_API_TOKEN="jūsų_api_token_čia"
```

### 3. Patikrinti VPS ID

Deploy skriptas naudoja VPS ID `1171365` (iš `srv1171365.hstgr.cloud`). Jei turite kitą VPS, pakeiskite `scripts/hostinger-deploy.js`:

```javascript
const VIRTUAL_MACHINE_ID = 1171365; // Pakeiskite į savo VPS ID
```

## Deployinimas

### Automatinis Deployinimas

```bash
npm run deploy:hostinger
```

Šis komandos:
1. Nuskaito `docker-compose.yml` iš GitHub repository
2. Sukuria naują Docker projektą Hostinger VPS
3. Paleidžia konteinerius
4. Rodo deployinimo statusą

### Kaip Veikia Deployinimas

1. **GitHub Repository** - Deploy skriptas naudoja GitHub repository URL:
   - Repository: `https://github.com/saparnisp/ping-pong`
   - Branch: `main`
   - Failas: `docker-compose.yml`

2. **API Užklausa** - Skriptas siunčia POST užklausą į Hostinger API:
   ```
   POST /api/vps/v1/virtual-machines/{vmId}/docker
   ```

3. **Docker Compose** - Hostinger Docker Manager:
   - Parsisiunčia `docker-compose.yml` iš GitHub
   - Build'ina Docker image (jei naudoja `build`)
   - Paleidžia konteinerius

4. **Statusas** - Deployinimas vyksta asinchroniškai:
   - Gaunamas `action_id`
   - Tikrinamas action statusas
   - Projektas atsiranda sąraše po kelių minučių

## Projekto Struktūra

```
blokeliai_final-2/
├── docker-compose.yml          # Docker Compose konfigūracija
├── Dockerfile                  # Docker image build'inimas
├── scripts/
│   ├── hostinger-deploy.js     # Pagrindinis deploy skriptas
│   ├── check-status.js         # Projekto statuso tikrinimas
│   └── build-and-push-docker.sh # Docker Hub image build'inimas (neprivalomas)
└── .env                        # API token (nepridėti į Git!)
```

## Docker Compose Konfigūracija

Dabartinis `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: blokeliai-app
    restart: unless-stopped
    ports:
      - "10000:10000"
    environment:
      - NODE_ENV=production
      - PORT=10000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:10000/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s
    networks:
      - blokeliai-network

networks:
  blokeliai-network:
    driver: bridge
```

## Projekto Valdymas

### Patikrinti Projekto Statusą

```bash
node scripts/check-status.js
```

Arba:

```bash
npm run deploy:hostinger
# Po deployinimo automatiškai rodo statusą
```

### Peržiūrėti Projekto Logus

Naudokite Hostinger API arba hPanel:
- hPanel → VPS → Docker Manager → Projekto logai

### Restart Projektas

Naudokite Hostinger API:

```bash
# Restart endpoint
POST /api/vps/v1/virtual-machines/{vmId}/docker/{projectName}/restart
```

Arba per hPanel → VPS → Docker Manager → Restart

### Ištrinti Projektą

```bash
# Delete endpoint
DELETE /api/vps/v1/virtual-machines/{vmId}/docker/{projectName}/down
```

## Troubleshooting

### Problema: Projektas nerastas po deployinimo

**Sprendimas:**
- Palaukite 2-3 minutes - deployinimas gali užtrukti
- Patikrinkite action statusą per API
- Patikrinkite, ar `docker-compose.yml` yra GitHub repository

### Problema: "No such image" klaida

**Priežastis:** Hostinger Docker Manager negali build'inti iš GitHub su `build` sekcija.

**Sprendimas:**
1. Sukurkite Docker image ir push'inkite į Docker Hub
2. Atnaujinkite `docker-compose.yml`, kad naudotų `image` vietoj `build`:

```yaml
services:
  app:
    image: your-username/blokeliai-app:latest  # Vietoj build
    # ... likę nustatymai
```

### Problema: API Token klaida

**Sprendimas:**
- Patikrinkite, ar token nustatytas `.env` faile
- Patikrinkite, ar token nepasibaigęs
- Sukurkite naują token iš hPanel

### Problema: "422 Validation Error"

**Priežastis:** `docker-compose.yml` formatas neteisingas arba failas nerastas GitHub'e.

**Sprendimas:**
- Patikrinkite, ar `docker-compose.yml` yra commit'intas į GitHub
- Patikrinkite, ar naudojamas teisingas branch
- Patikrinkite YAML sintaksę

## API Endpoints

### Projekto Sąrašas
```
GET /api/vps/v1/virtual-machines/{vmId}/docker
```

### Sukurti Projektą
```
POST /api/vps/v1/virtual-machines/{vmId}/docker
Body: {
  "project_name": "blokeliai-app",
  "content": "https://raw.githubusercontent.com/.../docker-compose.yml"
}
```

### Projekto Statusas
```
GET /api/vps/v1/virtual-machines/{vmId}/docker/{projectName}
```

### Action Statusas
```
GET /api/vps/v1/virtual-machines/{vmId}/actions/{actionId}
```

## Konfigūracijos Failai

### scripts/hostinger-deploy.js

Pagrindinės konfigūracijos:

```javascript
const API_BASE_URL = 'https://developers.hostinger.com';
const VIRTUAL_MACHINE_ID = 1171365; // Jūsų VPS ID
const PROJECT_NAME = 'blokeliai-app';
const GITHUB_REPO_URL = 'https://github.com/saparnisp/ping-pong';
const GITHUB_BRANCH = 'main';
```

## Deployment Workflow

1. **Kodo Pakeitimai**
   ```bash
   git add .
   git commit -m "Pakeitimai"
   git push origin Ping-Pong:main
   ```

2. **Deployinimas**
   ```bash
   npm run deploy:hostinger
   ```

3. **Statuso Tikrinimas**
   ```bash
   node scripts/check-status.js
   ```

## Saugumas

⚠️ **SVARBU:**
- Niekada necommit'inkite `.env` failo į Git
- Niekada nedalinkite API token viešai
- Naudokite `.gitignore` failą `.env` failui

## Papildoma Informacija

- [Hostinger API Dokumentacija](https://developers.hostinger.com)
- [Docker Compose Dokumentacija](https://docs.docker.com/compose/)
- [GitHub Repository](https://github.com/saparnisp/ping-pong)

## Pagalba

Jei kyla problemų:
1. Patikrinkite deploy logus
2. Patikrinkite Hostinger hPanel → VPS → Docker Manager
3. Patikrinkite API token galiojimą
4. Patikrinkite GitHub repository prieinamumą

