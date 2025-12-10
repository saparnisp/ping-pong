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
const PROJECT_NAME = 'blokeliai-app';
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

async function checkStatus() {
  try {
    console.log('📊 Tikrinamas projekto statusas...\n');
    
    // Get project list
    const projects = await apiRequest(`/api/vps/v1/virtual-machines/${VIRTUAL_MACHINE_ID}/docker`);
    console.log(`📦 Iš viso projektų: ${projects.data?.length || 0}\n`);
    
    const project = projects.data?.find(p => p.name === PROJECT_NAME);
    
    if (!project) {
      console.log('❌ Projektas nerastas');
      return;
    }
    
    console.log(`✅ Projektas "${PROJECT_NAME}" rastas:`);
    console.log(`   Statusas: ${project.status}`);
    console.log(`   Failas: ${project.file_path || 'N/A'}\n`);
    
    if (project.containers && project.containers.length > 0) {
      console.log('📦 Konteineriai:');
      project.containers.forEach(container => {
        console.log(`   - ${container.name}: ${container.status} (${container.image || 'N/A'})`);
        if (container.ports && container.ports.length > 0) {
          container.ports.forEach(port => {
            console.log(`     Port: ${port.public_port || 'N/A'} -> ${port.private_port || 'N/A'}`);
          });
        }
      });
    }
    
    // Get detailed project info
    try {
      const details = await apiRequest(`/api/vps/v1/virtual-machines/${VIRTUAL_MACHINE_ID}/docker/${PROJECT_NAME}`);
      console.log('\n📋 Detali informacija:');
      console.log(`   Statusas: ${details.data?.status || 'N/A'}`);
    } catch (e) {
      // Ignore if endpoint doesn't exist
    }
    
  } catch (error) {
    console.error('❌ Klaida:', error.message);
    process.exit(1);
  }
}

checkStatus();


