#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execPromise = promisify(exec);
const stat = promisify(fs.stat);

/**
 * Impacchetta un'estensione Firefox in formato XPI
 * @param {string} extensionDir - La directory dell'estensione Firefox
 * @param {string} outputPath - Percorso dove salvare il file XPI (opzionale)
 */
async function packageFirefoxExtension(extensionDir, outputPath = null) {
  try {
    // Verificare che la directory dell'estensione esista
    try {
      const stats = await stat(extensionDir);
      if (!stats.isDirectory()) {
        throw new Error(`"${extensionDir}" non è una directory.`);
      }
    } catch (error) {
      throw new Error(`Directory "${extensionDir}" non trovata: ${error.message}`);
    }

    // Verificare che il manifest esista
    const manifestPath = path.join(extensionDir, 'manifest.json');
    try {
      await stat(manifestPath);
    } catch (error) {
      throw new Error(`File manifest.json non trovato in "${extensionDir}". Assicurati che sia una directory di estensione Firefox valida.`);
    }

    // Determinare il nome del file XPI
    if (!outputPath) {
      const dirName = path.basename(extensionDir);
      outputPath = path.join(process.cwd(), `${dirName}.xpi`);
    }

    // Verificare se web-ext è installato
    let webExtInstalled = false;
    try {
      await execPromise('web-ext --version');
      webExtInstalled = true;
    } catch (error) {
      console.log('web-ext non è installato. Proverò con il metodo zip alternativo.');
    }

    if (webExtInstalled) {
      // Usare web-ext per impacchettare l'estensione (metodo migliore)
      try {
        console.log('Creazione del pacchetto XPI con web-ext...');
        
        // Creare una directory temporanea per l'output di web-ext
        const tempDir = path.join(process.cwd(), 'web-ext-artifacts');
        
        // Assicurarsi che la directory temporanea esista
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Eseguire web-ext per creare il pacchetto
        await execPromise(`web-ext build --source-dir "${extensionDir}" --artifacts-dir "${tempDir}" --overwrite-dest`);
        
        // Trovare il file XPI creato
        const files = fs.readdirSync(tempDir);
        const xpiFile = files.find(file => file.endsWith('.xpi'));
        
        if (!xpiFile) {
          throw new Error('Nessun file XPI trovato dopo l\'esecuzione di web-ext build.');
        }
        
        // Spostare il file XPI nella destinazione richiesta
        const sourcePath = path.join(tempDir, xpiFile);
        fs.copyFileSync(sourcePath, outputPath);
        
        // Opzionalmente, pulire la directory temporanea
        fs.unlinkSync(sourcePath);
        if (files.length === 1) {
          fs.rmdirSync(tempDir);
        }
        
        console.log(`Pacchetto XPI creato con successo: ${outputPath}`);
        
        // Validare l'estensione
        console.log('\nValidazione dell\'estensione...');
        try {
          const { stdout } = await execPromise(`web-ext lint --source-dir "${extensionDir}" --self-hosted`);
          console.log('Validazione completata:');
          console.log(stdout);
        } catch (lintError) {
          console.warn('Attenzione: Sono stati trovati problemi durante la validazione:');
          console.warn(lintError.stderr || lintError.message);
        }
      } catch (error) {
        throw new Error(`Errore durante l'impacchettamento con web-ext: ${error.message}`);
      }
    } else {
      // Metodo alternativo usando zip
      try {
        console.log('Tentativo di creazione del pacchetto XPI con zip...');
        await execPromise(`cd "${extensionDir}" && zip -r "${outputPath}" *`);
        console.log(`Pacchetto XPI creato con successo: ${outputPath}`);
        console.log('\nNOTA: Per una migliore validazione e compatibilità, installa web-ext:');
        console.log('npm install -g web-ext');
      } catch (zipError) {
        // Se zip fallisce, fornire istruzioni manuali
        console.error('Impossibile creare il pacchetto XPI automaticamente.');
        console.error('Il comando zip non è disponibile e web-ext non è installato.');
        console.error('\nPer installare gli strumenti necessari:');
        console.error('1. Installa web-ext (raccomandato): npm install -g web-ext');
        console.error('   oppure');
        console.error('2. Installa zip: sudo apt-get install zip (Linux) o brew install zip (macOS)');
        console.error('\nAlternativa manuale:');
        console.error('- Rinomina la cartella dell\'estensione con estensione .xpi');
        console.error('- In Firefox, vai a about:addons');
        console.error('- Clicca sull\'ingranaggio e seleziona "Installa componente aggiuntivo da file..."');
        throw new Error('Impossibile creare il pacchetto XPI. Si prega di installare web-ext o zip.');
      }
    }

    // Mostrare le istruzioni per l'installazione
    console.log('\n========== ISTRUZIONI PER L\'INSTALLAZIONE ==========');
    console.log('Per installare l\'estensione in Firefox:');
    console.log('\n1. Installazione temporanea (per test):');
    console.log('   - Apri Firefox e vai a about:debugging');
    console.log('   - Clicca su "Questo Firefox"');
    console.log('   - Clicca su "Carica componente aggiuntivo temporaneo..."');
    console.log(`   - Seleziona il file: ${outputPath}`);
    console.log('\n2. Installazione permanente:');
    console.log('   - Apri Firefox e vai a about:addons');
    console.log('   - Clicca sull\'icona dell\'ingranaggio');
    console.log('   - Seleziona "Installa componente aggiuntivo da file..."');
    console.log(`   - Seleziona il file: ${outputPath}`);
    console.log('=================================================');

    return outputPath;
  } catch (error) {
    console.error(`\nErrore: ${error.message}`);
    process.exit(1);
  }
}

// Gestione degli argomenti da linea di comando
function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('\n========== IMPACCHETTATORE DI ESTENSIONI FIREFOX ==========');
    console.log('Questo script crea un pacchetto XPI installabile da una directory di estensione Firefox.');
    console.log('\nUtilizzo:');
    console.log('node firefox-packager.js <path-estensione-firefox> [path-output-xpi]');
    console.log('\nArgumenti:');
    console.log('  <path-estensione-firefox>   Directory contenente l\'estensione Firefox');
    console.log('  [path-output-xpi]           Percorso dove salvare il file XPI (opzionale)');
    console.log('\nEsempio:');
    console.log('node firefox-packager.js ./mia-estensione-firefox ./mia-estensione.xpi');
    console.log('===================================================\n');
    process.exit(0);
  }
  
  return {
    extensionDir: args[0],
    outputPath: args.length > 1 ? args[1] : null
  };
}

// Esecuzione principale
async function main() {
  const { extensionDir, outputPath } = parseArguments();
  await packageFirefoxExtension(extensionDir, outputPath);
}

// Se questo script viene eseguito direttamente (non importato)
if (require.main === module) {
  main();
} else {
  // Esportare la funzione per l'uso in altri script
  module.exports = { packageFirefoxExtension };
}

// node firefoxXip.js AutoInvert-firefox AutoInvert-firefox.zip