/**
 * README Changelog Updater
 * Automatisiert das Anhängen von Commit-Kommentaren an die README.md
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const README_PATH = path.join(__dirname, 'README.md');
const PKG_PATH = path.join(__dirname, 'package.json');

// Dateien, die niemals im Changelog auftauchen sollen
const EXCLUDE_LIST = [path.basename(__filename), 'package.json', 'package-lock.json', 'README.md'];

try {
    // 1. Letzten Commit-Hash und Nachricht abrufen
    let fullMsg = execSync('git log -1 --pretty=%B').toString().trim();
    // Erste Zeile nehmen und Anführungszeichen säubern
    let commitMsg = fullMsg.split('\n')[0].trim();
    commitMsg = commitMsg.replace(/^["']|["']$/g, '');

    // NEU: Manueller Abbruch über die Commit-Nachricht (z.B. bei reinen Doku-Fixes)
    if (commitMsg.toLowerCase().includes('[skip log]') || commitMsg.toLowerCase().includes('[no changelog]')) {
        console.log('Update übersprungen: [skip log] Tag in Commit-Nachricht gefunden.');
        process.exit(0);
    }

    // 2. Aktuelle Version aus der package.json lesen
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    const currentVersion = pkg.version;

    // 3. Geänderte Dateien abrufen (Nur relevante .js Skripte in Unterordnern)
    const changedFiles = execSync('git diff-tree --no-commit-id --name-only -r HEAD')
        .toString()
        .trim()
        .split('\n')
        .filter(f => {
            const fileName = path.basename(f);
            const isJs = f.endsWith('.js');
            const isInSubfolder = f.includes('/') || f.includes('\\');
            const isExcluded = EXCLUDE_LIST.includes(fileName) || f.includes('node_modules');

            if (isJs && !isInSubfolder) console.log(`[Changelog] Überspringe Root-Datei: ${fileName}`);
            if (isExcluded) console.log(`[Changelog] Ignoriere System-Datei: ${fileName}`);

            return isJs && isInSubfolder && !isExcluded;
        });

    if (changedFiles.length === 0) {
        console.log('[Changelog] Keine relevanten Skript-Änderungen im Commit gefunden.');
        process.exit(0);
    }

    // 4. Changelog-Einträge vorbereiten
    const newEntries = changedFiles
        .map(f => `- Update von ${path.basename(f)} (${commitMsg})`)
        .join('\n');

    let content = fs.readFileSync(README_PATH, 'utf8');
    const today = new Date().toISOString().split('T')[0];
    const versionHeader = `### [${currentVersion}] - ${today}`;

    // 5. Version im Badge aktualisieren
    content = content.replace(/(Version-)(\d+\.\d+\.\d+)(-success)/, `$1${currentVersion}$3`);

    const changelogMarker = '## 📝 Changelog';

    // 6. Logik: Existiert die Version für heute schon?
    if (content.includes(versionHeader)) {
        const checkLine = newEntries.split('\n')[0];
        if (!content.includes(checkLine)) {
            const lines = content.split('\n');
            const headerIndex = lines.findIndex(l => l.includes(versionHeader));
            lines.splice(headerIndex + 1, 0, newEntries);
            content = lines.join('\n');
            console.log(`[Changelog] Eintrag zu ${currentVersion} hinzugefügt.`);
        } else {
            console.log('[Changelog] Eintrag existiert bereits.');
            process.exit(0);
        }
    } else {
        const newSection = `\n\n${versionHeader}\n${newEntries}`;
        content = content.replace(changelogMarker, `${changelogMarker}${newSection}`);
        console.log(`[Changelog] Neuer Block für Version ${currentVersion} erstellt.`);
    }

    fs.writeFileSync(README_PATH, content, 'utf8');

    // Auto-Staging: Fügt die geänderte README direkt wieder dem Git-Index hinzu
    execSync(`git add "${README_PATH}"`);
    console.log(`[Changelog] README.md wurde automatisch für den nächsten Sync gestaged.`);

} catch (error) {
    console.error('Fehler beim Aktualisieren der README:', error.message);
    process.exit(1);
}
