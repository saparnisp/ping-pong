#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
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

loadEnvFile();

const API_BASE_URL = 'https://developers.hostinger.com';
const VIRTUAL_MACHINE_ID = 1171365;
const API_TOKEN = process.env.HOSTINGER_API_TOKEN;

async function apiRequest(endpoint, method = 'GET') {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API klaida: ${response.status} - ${text.substring(0, 200)}`);
  }

  return await response.json();
}

async function checkContainers() {
  try {
    console.log('📊 Tikrinami Docker projektai...\n');
    
    // Get project list
    const projects = await apiRequest(`/api/vps/v1/virtual-machines/${VIRTUAL_MACHINE_ID}/docker`);
    console.log(`📦 Iš viso projektų: ${projects.data?.length || 0}\n`);
    
    if (projects.data && projects.data.length > 0) {
      projects.data.forEach(project => {
        console.log(`📦 Projektas: ${project.name}`);
        console.log(`   Statusas: ${project.status}`);
        console.log(`   Failas: ${project.file_path || 'N/A'}`);
        
        if (project.containers && project.containers.length > 0) {
          console.log(`   Konteineriai (${project.containers.length}):`);
          project.containers.forEach(container => {
            console.log(`     - ${container.name}`);
            console.log(`       Statusas: ${container.status}`);
            console.log(`       Image: ${container.image || 'N/A'}`);
            if (container.ports && container.ports.length > 0) {
              console.log(`       Portai:`);
              container.ports.forEach(port => {
                console.log(`         ${port.public_port || 'N/A'}:${port.private_port || 'N/A'}`);
              });
            } else {
              console.log(`       Portai: Nėra`);
            }
          });
        }
        console.log('');
      });
    } else {
      console.log('❌ Projektų nerasta');
    }
    
  } catch (error) {
    console.error('❌ Klaida:', error.message);
    process.exit(1);
  }
}

checkContainers();

