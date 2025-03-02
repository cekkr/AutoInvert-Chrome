#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * Converte un'estensione Chrome in un'estensione Firefox
 * @param {string} sourcePath - Il percorso dell'estensione Chrome
 * @param {string} outputPath - Il percorso in cui salvare l'estensione Firefox
 */
async function convertExtension(sourcePath, outputPath) {
  try {
    console.log(`Conversione dell'estensione da: ${sourcePath}`);
    console.log(`A: ${outputPath}`);

    // Creare la directory di output se non esiste
    await mkdir(outputPath, { recursive: true });

    // Convertire il manifest
    await convertManifest(sourcePath, outputPath);

    // Copiare tutti gli altri file
    await copyFiles(sourcePath, outputPath);

    console.log('Conversione completata con successo!');
  } catch (error) {
    console.error('Errore durante la conversione:', error);
    process.exit(1);
  }
}

/**
 * Converte il manifest.json da Chrome a Firefox
 */
async function convertManifest(sourcePath, outputPath) {
  const manifestPath = path.join(sourcePath, 'manifest.json');
  
  try {
    const manifestContent = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    // Convertire il manifest secondo le specifiche di Firefox
    const firefoxManifest = convertToFirefoxManifest(manifest);
    
    await writeFile(
      path.join(outputPath, 'manifest.json'),
      JSON.stringify(firefoxManifest, null, 2),
      'utf8'
    );
    
    console.log('Manifest convertito correttamente');
  } catch (error) {
    console.error('Errore nella conversione del manifest:', error);
    throw error;
  }
}

/**
 * Converte un manifest Chrome in un manifest Firefox
 */
function convertToFirefoxManifest(chromeManifest) {
  const firefoxManifest = { ...chromeManifest };
  
  // Gestire versione del manifest
  if (firefoxManifest.manifest_version === 3) {
    console.log('Avviso: Firefox supporta completamente MV3 ma potrebbero esserci differenze di implementazione');
  }
  
  // Gestire le API di estensione
  if (firefoxManifest.background) {
    if (firefoxManifest.background.service_worker) {
      const serviceWorkerScript = firefoxManifest.background.service_worker;
      
      // Firefox usa un oggetto "scripts" invece di "service_worker"
      if (firefoxManifest.manifest_version === 3) {
        firefoxManifest.background = {
          scripts: [serviceWorkerScript],
          type: 'module'
        };
      }
    }
  }
  
  // Gestire le permissions
  if (firefoxManifest.permissions) {
    // Firefox utilizza l'array "host_permissions" per gli URL pattern
    const hostPermissions = [];
    const regularPermissions = [];
    
    firefoxManifest.permissions.forEach(permission => {
      if (permission.includes('://') || permission === '<all_urls>') {
        hostPermissions.push(permission);
      } else {
        regularPermissions.push(permission);
      }
    });
    
    if (hostPermissions.length > 0) {
      firefoxManifest.host_permissions = hostPermissions;
      firefoxManifest.permissions = regularPermissions;
    }
  }
  
  // Gestire le apps commands
  if (firefoxManifest.commands) {
    for (const command in firefoxManifest.commands) {
      if (firefoxManifest.commands[command].suggested_key) {
        const suggestedKeys = firefoxManifest.commands[command].suggested_key;
        
        // Firefox utilizza "default" invece di "default"
        if (suggestedKeys.default) {
          suggestedKeys.default = suggestedKeys.default;
        }
        
        // Firefox non supporta suggested_key specifici per piattaforma
        delete suggestedKeys.mac;
        delete suggestedKeys.windows;
        delete suggestedKeys.linux;
        delete suggestedKeys.chromeos;
      }
    }
  }
  
  // Aggiungere browser_specific_settings per Firefox
  firefoxManifest.browser_specific_settings = {
    gecko: {
      id: `${firefoxManifest.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@firefox.extension`,
      strict_min_version: "42.0"
    }
  };
  
  // Rimuovere campi specifici di Chrome non supportati da Firefox
  delete firefoxManifest.minimum_chrome_version;
  delete firefoxManifest.update_url;
  
  return firefoxManifest;
}

/**
 * Copia tutti i file tranne manifest.json (che viene convertito separatamente)
 */
async function copyFiles(sourcePath, outputPath) {
  async function copyRecursive(currentSourcePath, currentOutputPath) {
    const entries = await readdir(currentSourcePath, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcEntryPath = path.join(currentSourcePath, entry.name);
      const outputEntryPath = path.join(currentOutputPath, entry.name);
      
      if (entry.isDirectory()) {
        await mkdir(outputEntryPath, { recursive: true });
        await copyRecursive(sourcEntryPath, outputEntryPath);
      } else if (entry.name !== 'manifest.json') {
        await copyFile(sourcEntryPath, outputEntryPath);
      }
    }
  }
  
  await copyRecursive(sourcePath, outputPath);
  console.log('File copiati correttamente');
}

// Gestione dei parametri da linea di comando
function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Utilizzo: node chrome-to-firefox.js <path-estensione-chrome> <path-output-firefox>');
    process.exit(1);
  }
  
  return {
    sourcePath: args[0],
    outputPath: args[1]
  };
}

// Esecuzione principale
async function main() {
  const { sourcePath, outputPath } = parseArguments();
  await convertExtension(sourcePath, outputPath);
}

main();