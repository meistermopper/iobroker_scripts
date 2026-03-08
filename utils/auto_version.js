/**
 * @file auto_version.js
 * @description Inkrementiert die Version und aktualisiert die CHANGELOG.md.
 * Optimiert für die Verwendung in GUI-Tools wie VS Code (keine Interaktion).
 * Läuft nur auf dem 'main' Branch.
 * @author Gemini 3 Flash
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hilfsfunktion zum Ausführen von Shell-Befehlen
 * @param {string} command - Der auszuführende Git-Befehl
 * @returns {string} Die bereinigte Ausgabe des Befehls
 */
function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (err) {
        console.error(`❌ Fehler bei: ${command}`, err.message);
        process.exit(1);
    }
}

// 1. Aktuellen Branch ermitteln
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');

// 2. Prüfung: Nur auf dem 'main' Branch aktiv werden
if (currentBranch !== 'main') {
    // Wenn nicht auf main, beenden wir das Skript ohne Änderungen
    process.exit(0);
}

const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

/**
 * Inkrementiert die Patch-Version (z.B. 1.0.4 -> 1.0.5)
 * @param {string} versionStr - Aktuelle Version
 * @returns {string} Neue Version
 */
function incrementPatch(versionStr) {
    const parts = versionStr.split('.');
    if (parts.length === 3) {
        parts[2] = parseInt(parts[2], 10) + 1;
    }
    return parts.join('.');
}

/**
 * Aktualisiert die CHANGELOG.md mit einem Standardeintrag
 * @param {string} version - Die neue Versionsnummer
 */
function updateChangelog(version) {
    const date = new Date().toISOString().split('T')[0]; // Aktuelles Datum YYYY-MM-DD
    
    // Standard-Nachricht, da in der GUI keine Abfrage möglich ist
    const logMessage = "Automatisches Update der Version.";
    const newEntry = `## [${version}] - ${date}\n- ${logMessage}\n\n`;

    let currentContent = '';
    if (fs.existsSync(changelogPath)) {
        currentContent = fs.readFileSync(changelogPath, 'utf8');
    } else {
        // Falls keine CHANGELOG.md existiert, erstellen wir eine Grundstruktur
        currentContent = '# Changelog\n\nAlle Änderungen werden hier dokumentiert.\n\n';
    }

    // Den neuen Eintrag direkt unter dem Header einfügen
    const headerEndIndex = currentContent.indexOf('\n\n') + 2;
    const updatedContent = currentContent.slice(0, headerEndIndex) + newEntry + currentContent.slice(headerEndIndex);

    fs.writeFileSync(changelogPath, updatedContent, 'utf8');
    
    // Die geänderte CHANGELOG.md wieder zum Git-Index hinzufügen
    runGitCommand(`git add "${changelogPath}"`);
}

// --- Hauptlogik ---
if (fs.existsSync(packagePath)) {
    try {
        const fileContent = fs.readFileSync(packagePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        const oldVersion = data.version;
        const newVersion = incrementPatch(oldVersion);

        // Version in package.json aktualisieren
        data.version = newVersion;
        fs.writeFileSync(packagePath, JSON.stringify(data, null, 2) + '\n');
        
        // Datei für Git vormerken
        runGitCommand(`git add "${packagePath}"`);

        // Falls vorhanden, auch io-package.json aktualisieren
        const ioPkgPath = path.join(rootDir, 'io-package.json');
        if (fs.existsSync(ioPkgPath)) {
            const ioData = JSON.parse(fs.readFileSync(ioPkgPath, 'utf8'));
            ioData.version = newVersion;
            fs.writeFileSync(ioPkgPath, JSON.stringify(ioData, null, 2) + '\n');
            runGitCommand(`git add "${ioPkgPath}"`);
        }

        // Changelog-Eintrag schreiben
        updateChangelog(newVersion);

        // Skript erfolgreich beenden
        process.exit(0);
    } catch (err) {
        console.error('❌ Fehler beim Update:', err.message);
        process.exit(1);
    }
} else {
    // Ohne package.json können wir nicht arbeiten
    process.exit(0);
}