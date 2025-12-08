#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if it exists
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }
    }
  }
}

// Load environment variables from .env file
loadEnvFile();

// Configuration
const API_BASE_URL = 'https://developers.hostinger.com';
const VIRTUAL_MACHINE_ID = 1171365; // iš srv1171365.hstgr.cloud
const PROJECT_NAME = 'blokeliai-app';
const GITHUB_REPO_URL = 'https://github.com/saparnisp/ping-pong'; // GitHub repository URL
const GITHUB_BRANCH = 'main'; // Branch name (main branch in new repo)

// Get API token from environment variable
const API_TOKEN = process.env.HOSTINGER_API_TOKEN;

if (!API_TOKEN || API_TOKEN === 'your_api_token_here') {
  console.error('❌ Klaida: HOSTINGER_API_TOKEN nėra nustatytas');
  console.error('Nustatykite .env faile arba: export HOSTINGER_API_TOKEN="jūsų_token"');
  console.error('Token gali gauti iš: https://hpanel.hostinger.com/api-tokens');
  process.exit(1);
}

// Read docker-compose.yml
function readDockerCompose() {
  const composePath = path.join(__dirname, '..', 'docker-compose.yml');
  if (!fs.existsSync(composePath)) {
    throw new Error(`docker-compose.yml nerastas: ${composePath}`);
  }
  return fs.readFileSync(composePath, 'utf-8');
}

// Make API request
async function apiRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    
    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error(`❌ API grąžino ne JSON. Status: ${response.status}`);
      console.error(`Response: ${text.substring(0, 500)}`);
      throw new Error(`API grąžino HTML vietoj JSON. Patikrinkite API token ir URL.`);
    }

    if (!response.ok) {
      throw new Error(`API klaida: ${response.status} - ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ API užklausos klaida:`, error.message);
    throw error;
  }
}

// Get list of projects
async function getProjectList() {
  console.log('📋 Gaunamas projektų sąrašas...');
  const endpoint = `/api/vps/v1/virtual-machines/${VIRTUAL_MACHINE_ID}/docker`;
  return await apiRequest(endpoint);
}

// Create new project
async function createProject(useGitHub = false) {
  console.log('🚀 Kuriamas naujas Docker projektas...');
  const endpoint = `/api/vps/v1/virtual-machines/${VIRTUAL_MACHINE_ID}/docker`;
  
  let content;
  if (useGitHub) {
    // Hostinger API automatically resolves to docker-compose.yaml in master branch
    // If we need a specific branch, we might need to use raw GitHub URL instead
    console.log(`📦 Naudojamas GitHub repository: ${GITHUB_REPO_URL}`);
    console.log(`🌿 Branch: ${GITHUB_BRANCH}`);
    // Try using raw GitHub URL for specific branch
    const rawUrl = `https://raw.githubusercontent.com/saparnisp/blokeliai_final/${GITHUB_BRANCH}/docker-compose.yml`;
    console.log(`📄 Raw URL: ${rawUrl}`);
    content = rawUrl; // Use raw URL for specific branch
  } else {
    console.log('📖 Naudojamas lokalus docker-compose.yml failas');
    content = readDockerCompose();
  }
  
  const body = {
    project_name: PROJECT_NAME,
    content: content, // Ensure it's a string
  };

  console.log(`📤 Siunčiama užklausa į: ${endpoint}`);
  console.log(`📝 Projekto pavadinimas: ${PROJECT_NAME}`);
  console.log(`📄 Content tipas: ${typeof content}, ilgis: ${content.length}`);
  
  const result = await apiRequest(endpoint, 'POST', body);
  console.log('📥 API atsakymas:', JSON.stringify(result, null, 2));
  
  return result;
}

// Get project status
async function getProjectStatus() {
  const endpoint = `/api/vps/v1/virtual-machines/${VIRTUAL_MACHINE_ID}/docker/${PROJECT_NAME}`;
  try {
    return await apiRequest(endpoint);
  } catch (error) {
    return null;
  }
}

// Main deployment function
async function deploy() {
  try {
    console.log('🎮 Blokeliai deployinimas į Hostinger VPS...\n');

    // Check existing projects
    const projects = await getProjectList();
    console.log(`📦 Rasti ${projects.data?.length || 0} projektai\n`);

    // Check if project already exists
    const existingProject = projects.data?.find(p => p.name === PROJECT_NAME);
    
    if (existingProject) {
      console.log(`⚠️  Projektas "${PROJECT_NAME}" jau egzistuoja`);
      console.log(`   Statusas: ${existingProject.status}`);
      console.log(`   Failas: ${existingProject.file_path}\n`);
      console.log('💡 Jei norite atnaujinti projektą, naudokite update funkciją');
      console.log('   Arba ištrinkite esamą projektą ir paleiskite deploy iš naujo\n');
      return;
    }

    // Try GitHub first, fallback to local file
    let result;
    try {
      console.log('🔄 Bandoma naudoti GitHub repository...\n');
      result = await createProject(true);
    } catch (error) {
      console.log('⚠️  GitHub nepavyko, naudojamas lokalus docker-compose.yml...\n');
      console.log('📖 Skaitomas docker-compose.yml...');
      const composeContent = readDockerCompose();
      console.log('✅ docker-compose.yml perskaitytas\n');
      result = await createProject(false);
    }
    
    console.log('\n✅ Deployinimo užduotis pradėta!');
    const actionId = result.id || result.data?.id;
    if (actionId) {
      console.log(`   Action ID: ${actionId}`);
      console.log(`   Statusas: ${result.state || result.data?.state || 'N/A'}`);
    }
    console.log('');

    console.log('⏳ Palaukite, kol projektas bus sukonfigūruotas...');
    console.log('   Tai gali užtrukti kelias minutes\n');

    // Wait and check action status
    if (actionId) {
      console.log('⏳ Tikrinamas action statusas...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      try {
        const actionStatus = await apiRequest(`/api/vps/v1/virtual-machines/${VIRTUAL_MACHINE_ID}/actions/${actionId}`);
        console.log(`📊 Action statusas: ${actionStatus.data?.state || actionStatus.state || 'N/A'}`);
      } catch (e) {
        console.log('⚠️  Nepavyko gauti action statuso');
      }
    }

    // Wait a bit more and check project list
    console.log('\n⏳ Tikrinamas projektų sąrašas...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const updatedProjects = await getProjectList();
    const newProject = updatedProjects.data?.find(p => p.name === PROJECT_NAME);
    
    if (newProject) {
      console.log('\n✅ Projektas rastas!');
      console.log(`   Statusas: ${newProject.status}`);
      console.log(`   Failas: ${newProject.file_path || 'N/A'}`);
      if (newProject.containers && newProject.containers.length > 0) {
        console.log(`   Konteineriai: ${newProject.containers.length}`);
        newProject.containers.forEach(container => {
          console.log(`     - ${container.name}: ${container.status}`);
          if (container.ports && container.ports.length > 0) {
            container.ports.forEach(port => {
              console.log(`       Port: ${port.public_port || 'N/A'} -> ${port.private_port || 'N/A'}`);
            });
          }
        });
      }
    } else {
      console.log('\n⚠️  Projektas dar nerastas sąraše.');
      console.log('   Gali užtrukti dar kelios minutės. Patikrinkite vėliau su:');
      console.log('   node scripts/check-status.js');
    }

    console.log('\n🎉 Deployinimas baigtas!');
    console.log(`🌐 Aplikacija turėtų būti prieinama: http://72.62.1.133:10000`);

  } catch (error) {
    console.error('\n❌ Deployinimo klaida:', error.message);
    process.exit(1);
  }
}

// Run deployment
deploy();

