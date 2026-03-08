/**
 * @file auto_version.js
 * @description Inkrementiert die Patch-Version in package.json/io-package.json, 
 * aber nur wenn der Commit auf dem 'main' Branch erfolgt.
 * @author Gemini 3 Flash
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hilfsfunktion zum Ausführen von Shell-Befehlen
 * @param {string} command - Der auszuführende Befehl
 * @returns {string} Die bereinigte Ausgabe des Befehls
 */
function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (err) {
        console.error(`❌ Fehler beim Ausführen von: ${command}`, err.message);
        process.exit(1);
    }
}

// 1. Den aktuellen Branch-Namen ermitteln
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');

console.log(`--- Start: Auto Versioning Hook (Branch: ${currentBranch}) ---`);

// 2. Prüfung: Sind wir auf 'main'?
if (currentBranch !== 'main') {
    console.log('ℹ️  Info: Kein Commit auf "main". Versionierung wird übersprungen.');
    // Wir beenden das Skript erfolgreich (0), damit der Commit normal weiterlaufen kann.
    process.exit(0);
}

// Pfade zu den relevanten Dateien (ausgehend vom Skript-Ort im Ordner 'utils')
const rootDir = path.join(__dirname, '..');
const filesToUpdate = [
    path.join(rootDir, 'package.json'),
    path.join(rootDir, 'io-package.json')
];

/**
 * Inkrementiert die Patch-Version (z.B. 1.0.5 -> 1.0.6)
 * @param {string} versionStr - Die aktuelle Versionsnummer
 * @returns {string} Die neue Versionsnummer
 */
function incrementPatch(versionStr) {
    const parts = versionStr.split('.');
    if (parts.length === 3) {
        // Die letzte Stelle (Patch) wird um 1 erhöht
        parts[2] = parseInt(parts[2], 10) + 1;
    }
    return parts.join('.');
}

let versionUpdated = false;
let newVersion = '';

// 3. Dateien verarbeiten
filesToUpdate.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        try {
            // Datei einlesen und als JSON parsen
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            
            const oldVersion = data.version;
            
            // Neue Version nur einmal berechnen, damit beide Dateien synchron bleiben
            if (!newVersion) {
                newVersion = incrementPatch(oldVersion);
            }
            data.version = newVersion;
            
            // Datei formatiert speichern (2 Leerzeichen Einzug)
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
            
            console.log(`✅ ${path.basename(filePath)}: ${oldVersion} -> ${newVersion}`);
            
            // Datei wieder für den aktuellen Commit vormerken (stagen)
            runGitCommand(`git add "${filePath}"`);
            versionUpdated = true;
        } catch (err) {
            console.error(`❌ Fehler beim Bearbeiten von ${filePath}:`, err.message);
            process.exit(1); // Commit bei Fehlern abbrechen
        }
    }
});

if (versionUpdated) {
    console.log(`--- Fertig: Version auf ${newVersion} angehoben ---`);
} else {
    console.log('--- Info: Keine relevanten Dateien zum Aktualisieren gefunden ---');
}

process.exit(0);