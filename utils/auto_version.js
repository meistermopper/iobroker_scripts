/**
 * @file auto_version.js
 * @description Inkrementiert die Version in der package.json und pflegt die CHANGELOG.md.
 * Die README.md bleibt von diesem Skript unberührt.
 * @author Gemini 3 Flash
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Führt einen Git-Befehl aus und fängt Fehler ab.
 * @param {string} command - Der auszuführende Git-Befehl.
 */
function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (err) {
        // Keine Satzpunkte am Ende der Logs, um ioBroker-Validierungsfehler zu vermeiden
        console.error(`❌ Git-Fehler: ${command}`, err.message);
        process.exit(1);
    }
}

// 1. Prüfung: Wir führen die Versionierung nur auf dem 'main' Branch aus
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');
if (currentBranch !== 'main') {
    console.log(`ℹ️  Info: Branch ist "${currentBranch}" - Keine automatische Versionierung`);
    process.exit(0);
}

// Pfade zu den Dateien definieren
const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

/**
 * Erhöht die Patch-Stelle der Version (z.B. 1.0.7 -> 1.0.8).
 * @param {string} v - Die aktuelle Versionsnummer.
 * @returns {string} Die neue Versionsnummer.
 */
function incrementPatch(v) {
    const parts = v.split('.');
    if (parts.length === 3) {
        parts[2] = parseInt(parts[2], 10) + 1;
    }
    return parts.join('.');
}

/**
 * Ermittelt die Liste der geänderten Dateien für den Changelog.
 * @returns {string} Eine Liste der Dateinamen oder ein Standardtext.
 */
function getChangedFilesList() {
    try {
        const files = runGitCommand('git diff --cached --name-only')
            .split('\n')
            .filter(f => {
                const name = f.trim();
                // Metadaten-Dateien aus der Liste für den Changelog filtern
                return name && !['package.json', 'CHANGELOG.md', 'README.md'].includes(name);
            })
            .map(f => `- Update von ${path.basename(f)}`);

        return files.length > 0 ? files.join('\n') : '- Code-Optimierungen und Updates';
    } catch (e) {
        return '- Dokumentation und Skripte aktualisiert';
    }
}

// --- Hauptprozess ---
console.log('--- Start: Auto Versioning (Hintergrund) ---');

if (fs.existsSync(packagePath)) {
    try {
        // 1. package.json einlesen und Version erhöhen
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const oldV = pkg.version;
        const newV = incrementPatch(oldV);

        pkg.version = newV;
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        runGitCommand(`git add "${packagePath}"`);
        console.log(`✅ package.json: ${oldV} -> ${newV}`);

        // 2. CHANGELOG.md aktualisieren
        const date = new Date().toISOString().split('T')[0];
        const fileList = getChangedFilesList();
        const newEntry = `## [${newV}] - ${date}\n${fileList}`;
        
        const changelogHeader = '# Changelog\n\nAlle wichtigen Änderungen dieses Projekts werden hier dokumentiert.';
        let oldContent = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';
        
        // Entferne den alten Header und überflüssige Leerzeilen, um Duplikate zu vermeiden.
        // Dies bereinigt die Datei bei jedem Durchlauf.
        oldContent = oldContent.replace(/# Changelog\n\n(Alle wichtigen Änderungen dieses Projekts werden hier dokumentiert\.)?/, '').trim();

        // Baue den neuen Inhalt zusammen: Header, neuer Eintrag, alter Inhalt.
        const updatedChContent = `${changelogHeader}\n\n${newEntry}\n\n${oldContent}`.trim() + '\n';
        
        fs.writeFileSync(changelogPath, updatedChContent, 'utf8');
        runGitCommand(`git add "${changelogPath}"`);
        console.log(`📝 CHANGELOG.md für v${newV} aktualisiert`);

        console.log(`--- Erfolg: Version ${newV} ist bereit für den Commit ---`);
    } catch (e) {
        console.error('❌ Fehler während der Versionierung:', e.message);
        process.exit(1);
    }
} else {
    console.error('❌ Fehler: Keine package.json gefunden');
    process.exit(1);
}