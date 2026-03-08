/**
 * @file auto_version.js
 * @description Inkrementiert die Version und erstellt ein spezifisches Changelog 
 * basierend auf den tatsächlich geänderten Dateien.
 * @author Gemini 3 Flash
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hilfsfunktion für Git-Befehle
 */
function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (err) {
        console.error(`❌ Git-Fehler bei Befehl: ${command}`, err.message);
        process.exit(1);
    }
}

// Nur auf 'main' aktiv werden
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');
if (currentBranch !== 'main') process.exit(0);

const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

/**
 * Erhöht die Patch-Version (1.0.x)
 */
function incrementPatch(v) {
    const p = v.split('.');
    if (p.length === 3) p[2] = parseInt(p[2], 10) + 1;
    return p.join('.');
}

/**
 * Ermittelt die Namen der geänderten Dateien im aktuellen Commit-Versuch
 * @returns {string} Eine formatierte Liste der Dateinamen
 */
function getChangedFilesList() {
    // Holt die Liste der Dateien, die bereits für den Commit vorgemerkt (staged) sind
    const files = runGitCommand('git diff --cached --name-only')
        .split('\n')
        .filter(f => {
            // Wir filtern Systemdateien und das Changelog selbst aus der Liste aus
            const name = f.trim();
            return name && 
                   name !== 'package.json' && 
                   name !== 'CHANGELOG.md' && 
                   name !== 'README.md' && 
                   name !== 'io-package.json';
        })
        .map(f => `- Update von ${path.basename(f)}`); // Nur den Dateinamen anzeigen

    return files.length > 0 ? files.join('\n') : '- Allgemeine Code-Verbesserungen';
}

/**
 * Aktualisiert die README.md
 */
function updateReadme(newVersion) {
    if (!fs.existsSync(readmePath)) return;
    let content = fs.readFileSync(readmePath, 'utf8');
    const newBadge = `![Version](https://img.shields.io/badge/version-${newVersion}-orange)`;
    const anyVersionBadgeRegex = /!\[Version\]\(https:\/\/img\.shields\.io\/.*version.*\)/gi;
    
    content = content.replace(anyVersionBadgeRegex, '');
    const titleRegex = /^(# ioBroker Script-Sammlung\s*)/m;
    if (titleRegex.test(content)) {
        content = content.replace(titleRegex, `$1\n\n${newBadge} `);
    }
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(readmePath, content.trim() + '\n', 'utf8');
    runGitCommand(`git add "${readmePath}"`);
    console.log(`📖 README.md auf v${newVersion} aktualisiert`);
}

/**
 * Aktualisiert die CHANGELOG.md mit spezifischen Datei-Infos
 */
function updateChangelog(v) {
    const date = new Date().toISOString().split('T')[0];
    const fileList = getChangedFilesList(); // Hier holen wir die spezifischen Infos
    
    const newEntry = `## [${v}] - ${date}\n${fileList}\n\n`;
    
    let content = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
    const headerEnd = content.indexOf('\n\n') + 2;
    
    fs.writeFileSync(changelogPath, content.slice(0, headerEnd) + newEntry + content.slice(headerEnd));
    runGitCommand(`git add "${changelogPath}"`);
    console.log(`📝 CHANGELOG.md aktualisiert für v${v}`);
}

// --- Hauptprozess ---
if (fs.existsSync(packagePath)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const oldV = pkg.version;
        const newV = incrementPatch(oldV);

        // 1. package.json aktualisieren
        pkg.version = newV;
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
        runGitCommand(`git add "${packagePath}"`);
        console.log(`✅ package.json: ${oldV} -> ${newV}`);

        // 2. Dokumentation pflegen
        updateChangelog(newV);
        updateReadme(newV);

        console.log(`--- Erfolg: Version ${newV} ist bereit für den Commit ---`);
        process.exit(0);
    } catch (e) {
        console.error('❌ Fehler während des Updates:', e.message);
        process.exit(1);
    }
}