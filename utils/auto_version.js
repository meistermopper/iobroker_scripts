/**
 * @file auto_version.js
 * @description Inkrementiert die Version, aktualisiert die CHANGELOG.md 
 * und integriert das Version-Badge in die README.md.
 * * HINWEIS: Alle Satzpunkte am Ende von Log-Ausgaben wurden entfernt,
 * um "Invalid ID"-Fehler in ioBroker zu vermeiden.
 * * @author Gemini 3 Flash
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Führt Git-Befehle aus und fängt Fehler ab.
 * @param {string} command - Der auszuführende Befehl.
 */
function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (err) {
        // Hier ebenfalls kein Punkt am Ende, um ioBroker-Fehler zu vermeiden
        console.error(`❌ Git-Fehler bei Befehl: ${command}`, err.message);
        process.exit(1);
    }
}

// Prüfen, ob wir auf dem main-Branch sind
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');
if (currentBranch !== 'main') {
    console.log(`ℹ️  Info: Branch ist "${currentBranch}" - Auto-Versionierung nur auf main`);
    process.exit(0);
}

// Pfade definieren
const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

/**
 * Erhöht die Patch-Version (z.B. 1.0.12 -> 1.0.13)
 * @param {string} v - Die aktuelle Version.
 */
function incrementPatch(v) {
    const parts = v.split('.');
    if (parts.length === 3) {
        parts[2] = parseInt(parts[2], 10) + 1;
    }
    return parts.join('.');
}

/**
 * Aktualisiert die README.md und setzt das Badge direkt unter die H1-Überschrift.
 * @param {string} newVersion - Die neue Versionsnummer.
 */
function updateReadme(newVersion) {
    if (!fs.existsSync(readmePath)) return;

    let content = fs.readFileSync(readmePath, 'utf8');
    const newBadge = `![Version](https://img.shields.io/badge/version-${newVersion}-orange)`;
    
    // Alle alten Versions-Badges im Dokument finden und entfernen
    const anyVersionBadgeRegex = /!\[Version\]\(https:\/\/img\.shields\.io\/.*version.*\)/gi;
    content = content.replace(anyVersionBadgeRegex, '');

    // Das Badge direkt nach der Hauptüberschrift einfügen
    const titleRegex = /^(# ioBroker Script-Sammlung\s*)/m;
    if (titleRegex.test(content)) {
        content = content.replace(titleRegex, `$1\n\n${newBadge} `);
    }

    // Doppelte Leerzeilen bereinigen
    content = content.replace(/\n{3,}/g, '\n\n');

    fs.writeFileSync(readmePath, content.trim() + '\n', 'utf8');
    runGitCommand(`git add "${readmePath}"`);
    console.log(`📖 README.md auf v${newVersion} aktualisiert`);
}

/**
 * Fügt einen neuen Eintrag oben in die CHANGELOG.md ein.
 * @param {string} v - Die neue Versionsnummer.
 */
function updateChangelog(v) {
    const date = new Date().toISOString().split('T')[0];
    const newEntry = `## [${v}] - ${date}\n- Dokumentation aktualisiert und Version angehoben\n\n`;
    
    let content = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
    
    // Den neuen Eintrag direkt nach dem Header einfügen
    const headerEnd = content.indexOf('\n\n') + 2;
    const updatedContent = content.slice(0, headerEnd) + newEntry + content.slice(headerEnd);
    
    fs.writeFileSync(changelogPath, updatedContent, 'utf8');
    runGitCommand(`git add "${changelogPath}"`);
    console.log(`📝 CHANGELOG.md aktualisiert (v${v})`);
}

// --- Hauptlogik ---
console.log(`--- Start: Auto Versioning (Branch: ${currentBranch}) ---`);

if (fs.existsSync(packagePath)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const oldV = pkg.version;
        const newV = incrementPatch(oldV);

        // 1. package.json schreiben
        pkg.version = newV;
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
        runGitCommand(`git add "${packagePath}"`);
        console.log(`✅ package.json: ${oldV} -> ${newV}`);

        // 2. io-package.json ebenfalls synchronisieren (falls vorhanden)
        const ioPkgPath = path.join(rootDir, 'io-package.json');
        if (fs.existsSync(ioPkgPath)) {
            const ioPkg = JSON.parse(fs.readFileSync(ioPkgPath, 'utf8'));
            ioPkg.version = newV;
            fs.writeFileSync(ioPkgPath, JSON.stringify(ioPkg, null, 2) + '\n');
            runGitCommand(`git add "${ioPkgPath}"`);
            console.log(`✅ io-package.json ebenfalls auf ${newV} aktualisiert`);
        }

        // 3. Dokumentation pflegen
        updateChangelog(newV);
        updateReadme(newV);

        console.log(`--- Erfolg: Version ${newV} ist bereit für den Commit ---`);
        process.exit(0);
    } catch (e) {
        console.error('❌ Fehler während des Updates:', e.message);
        process.exit(1);
    }
} else {
    console.error('❌ Fehler: Keine package.json gefunden');
    process.exit(1);
}