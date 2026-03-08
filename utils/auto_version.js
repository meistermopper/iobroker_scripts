/**
 * @file auto_version.js
 * @description Inkrementiert die Version in der package.json und pflegt den Changelog in der README.md.
 * Aktualisiert zudem das Versions-Badge in der README.md.
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
            .map(f => `- Update von ${path.basename(f)}`);

        return files.length > 0 ? files.join('\n') : '- Code-Optimierungen und Updates';
    } catch (e) {
        return '- Dokumentation und Skripte aktualisiert';
    }
}

// --- Hauptprozess ---
console.log('--- Start: Auto Versioning (Single Source of Truth) ---');

if (!fs.existsSync(packagePath)) {
    console.error('❌ Fehler: Keine package.json gefunden');
    process.exit(1);
}
if (!fs.existsSync(readmePath)) {
    console.error('❌ Fehler: Keine README.md gefunden');
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
    console.log(`✅ package.json: ${oldV} -> ${newV}`);

    // 2. README.md aktualisieren (Badge und Changelog)
    let readmeContent = fs.readFileSync(readmePath, 'utf8');

    // 2a. Badge aktualisieren
    const badgeRegex = /(!\[Version\]\(.*\/Version-)([\d\.]+)(-success\?style=flat-square\))/;
    if (badgeRegex.test(readmeContent)) {
        readmeContent = readmeContent.replace(badgeRegex, `$1${newV}$3`);
        console.log(`📘 README.md Badge auf v${newV} aktualisiert`);
    } else {
        console.warn('⚠️ Versions-Badge in README.md nicht gefunden. Badge nicht aktualisiert.');
    }

    // 2b. Changelog-Eintrag erstellen und einfügen
    const date = new Date().toISOString().split('T')[0];
    const fileList = getChangedFilesList();
    // Wichtig: ### verwenden, damit es zur README-Struktur passt
    const newEntry = `### [${newV}] - ${date}\n${fileList}`;

    const changelogMarker = 'Alle wichtigen Änderungen dieses Projekts werden hier dokumentiert.';
    const markerIndex = readmeContent.indexOf(changelelogMarker);

    if (markerIndex !== -1) {
        const insertionPoint = markerIndex + changelogMarker.length;
        // Füge den neuen Eintrag mit korrekten Zeilenumbrüchen nach dem Marker ein
        readmeContent = readmeContent.slice(0, insertionPoint) + `\n\n${newEntry}` + readmeContent.slice(insertionPoint);
        console.log(`📝 README.md Changelog für v${newV} aktualisiert`);
    } else {
        console.warn('⚠️ Changelog-Marker in README.md nicht gefunden. Eintrag wird nicht hinzugefügt.');
    }

    // 3. Aktualisierte README.md speichern und zu Git hinzufügen
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    runGitCommand(`git add "${readmePath}"`);

    console.log(`--- Erfolg: Version ${newV} ist bereit für den Commit ---`);

} catch (e) {
    console.error('❌ Fehler während der Versionierung:', e.message);
    process.exit(1);
}
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

        // 3. README.md aktualisieren (Badge)
        if (fs.existsSync(readmePath)) {
            let readmeContent = fs.readFileSync(readmePath, 'utf8');
            // Ersetzt die Version im Badge: !Version
            const badgeRegex = /(!\[Version\]\(.*\/Version-)([\d\.]+)(-success\?style=flat-square\))/;
            
            if (badgeRegex.test(readmeContent)) {
                readmeContent = readmeContent.replace(badgeRegex, `$1${newV}$3`);
                fs.writeFileSync(readmePath, readmeContent, 'utf8');
                runGitCommand(`git add "${readmePath}"`);
                console.log(`📘 README.md Badge auf v${newV} aktualisiert`);
            }
        }

        console.log(`--- Erfolg: Version ${newV} ist bereit für den Commit ---`);
    } catch (e) {
        console.error('❌ Fehler während der Versionierung:', e.message);
        process.exit(1);
    }
} else {
    console.error('❌ Fehler: Keine package.json gefunden');
    process.exit(1);
}