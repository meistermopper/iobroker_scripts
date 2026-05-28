/**
 * @file auto_version.js
 * @description Increments the version in package.json and maintains the changelog in README.md.
 * Also updates the version badge in README.md.
 * @author Gemini Code Assist
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
        // No periods at the end of logs to avoid ioBroker validation errors
        console.error(`❌ Git Error: ${command}`, err.message);
        process.exit(1);
    }
}

// 1. Prüfung: Wir führen die Versionierung nur auf dem 'main' Branch aus
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');
if (currentBranch !== 'main' && currentBranch !== 'master') {
    console.log(`ℹ️  Info: Branch is "${currentBranch}" - Skipping automatic versioning`);
    process.exit(0);
}

// Pfade zu den Dateien definieren
const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');

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
                // Metadaten-Dateien und das Skript selbst aus der Liste für den Changelog filtern
                return name && !['package.json', 'README.md', 'utils/auto_version.js'].includes(name);
            })
            .map(f => `- Update of ${path.basename(f)}`);

        return files.length > 0 ? files.join('\n') : '- Code optimizations and updates';
    } catch (e) {
        return '- Documentation and scripts updated';
    }
}

// --- Hauptprozess ---
console.log('--- Start: Auto Versioning (Single Source of Truth) ---');

if (!fs.existsSync(packagePath)) {
    console.error('❌ Error: package.json not found');
    process.exit(1);
}
if (!fs.existsSync(readmePath)) {
    console.error('❌ Error: README.md not found');
    process.exit(1);
}

try {
    // 1. package.json einlesen und Version erhöhen
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const oldV = pkg.version;
    const newV = incrementPatch(oldV);

    pkg.version = newV;
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    runGitCommand(`git add "${packagePath}"`);
    console.log(`✅ package.json updated: ${oldV} -> ${newV}`);

    // 2. README.md aktualisieren (Badge und Changelog)
    let readmeContent = fs.readFileSync(readmePath, 'utf8');

    // 2a. Badge aktualisieren
    const badgeRegex = /(!\[Version\]\(.*\/Version-)([\d\.]+)(-success\?style=flat-square\))/;
    if (badgeRegex.test(readmeContent)) {
        readmeContent = readmeContent.replace(badgeRegex, `$1${newV}$3`);
        console.log(`📘 README.md badge updated to v${newV}`);
    } else {
        console.warn('⚠️ Version badge in README.md not found. Badge not updated.');
    }

    // 2b. Changelog-Eintrag erstellen und einfügen
    const date = new Date().toISOString().split('T')[0];
    const fileList = getChangedFilesList();
    // Important: Using ### to match the README structure
    const newEntry = `### [${newV}] - ${date}\n${fileList}`;

    const changelogMarker = '## 📝 Changelog';
    const markerIndex = readmeContent.indexOf(changelogMarker);

    if (markerIndex !== -1) {
        const insertionPoint = markerIndex + changelogMarker.length;
        // Insert the new entry with correct line breaks after the marker
        readmeContent = readmeContent.slice(0, insertionPoint) + `\n\n${newEntry}` + readmeContent.slice(insertionPoint);
        console.log(`📝 README.md changelog updated for v${newV}`);
    } else {
        console.warn('⚠️ Changelog marker in README.md not found. Entry not added.');
    }

    // 3. Aktualisierte README.md speichern und zu Git hinzufügen
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    runGitCommand(`git add "${readmePath}"`);

    console.log(`--- Erfolg: Version ${newV} ist bereit für den Commit ---`);

} catch (e) {
    console.error('❌ Fehler während der Versionierung:', e.message);
    process.exit(1);
}
