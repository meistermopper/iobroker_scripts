/**
 * @file auto_version.js
 * @description Inkrementiert automatisch die Patch-Version in package.json und io-package.json.
 * @author Gemini 3 Flash
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Pfade zu den relevanten Dateien (ausgehend vom Skript-Ort)
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

console.log('--- Start: Auto Versioning Hook ---');

let versionUpdated = false;
let newVersion = '';

filesToUpdate.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        try {
            // Datei einlesen
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            
            // Alte Version speichern (für die Log-Ausgabe)
            const oldVersion = data.version;
            
            // Version erhöhen
            if (!newVersion) {
                newVersion = incrementPatch(oldVersion);
            }
            data.version = newVersion;
            
            // Zurückschreiben der Datei (schön formatiert mit 2 Leerzeichen)
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
            
            console.log(`✅ ${path.basename(filePath)}: ${oldVersion} -> ${newVersion}`);
            
            // WICHTIG: Die geänderte Datei wieder zum Git-Index hinzufügen,
            // damit sie Teil des aktuellen Commits wird.
            execSync(`git add "${filePath}"`);
            versionUpdated = true;
        } catch (err) {
            console.error(`❌ Fehler beim Bearbeiten von ${filePath}:`, err.message);
            process.exit(1); // Commit abbrechen bei Fehler
        }
    }
});

if (versionUpdated) {
    console.log('--- Fertig: Version wurde aktualisiert ---');
} else {
    console.log('--- Info: Keine relevanten Dateien zum Aktualisieren gefunden ---');
}

process.exit(0);