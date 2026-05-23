/**
 * README Changelog Updater
 * Automatisiert das Anhängen von Commit-Kommentaren an die README.md
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const README_PATH = path.join(__dirname, 'README.md');
const PKG_PATH = path.join(__dirname, 'package.json');

try {
    // 1. Letzten Commit-Hash und Nachricht abrufen
    // Wir nutzen %B für die volle Nachricht und nehmen die erste Zeile.
    // Zusätzlich entfernen wir potenzielle Anführungszeichen, die Gemini manchmal setzt.
    let commitMsg = execSync('git log -1 --pretty=%B').toString().split('\n')[0].trim();
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
        .filter(f =>
            f.endsWith('.js') &&
            f.includes('/') &&              // Nur in Unterordnern (ignoriert Root-Tools)
            !f.includes('node_modules') &&
            !f.includes(path.basename(__filename))
        );

    if (changedFiles.length === 0) {
        // Hier landen wir, wenn NUR die README.md oder andere Nicht-JS-Dateien geändert wurden
        console.log('Nur Dokumentation oder Systemdateien geändert. Changelog bleibt unverändert.');
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

    const changelogMarker = '## 📝 Changelog\n\n';

    // 6. Logik: Existiert die Version für heute schon?
    if (content.includes(versionHeader)) {
        // Wenn ja: Eintrag unter die existierende Überschrift schieben (falls noch nicht da)
        const checkLine = newEntries.split('\n')[0];
        if (!content.includes(checkLine)) {
            // Wir fügen die neuen Zeilen direkt nach dem Header ein
            const lines = content.split('\n');
            const headerIndex = lines.findIndex(l => l.includes(versionHeader));
            lines.splice(headerIndex + 1, 0, newEntries);
            content = lines.join('\n');
            console.log(`Änderungen zur bestehenden Version ${currentVersion} hinzugefügt.`);
        } else {
            console.log('Änderungen sind bereits im Changelog enthalten.');
            process.exit(0);
        }
    } else {
        // Wenn nein: Neuen Block erstellen
        const newSection = `${versionHeader}\n${newEntries}\n\n`;
        content = content.replace(changelogMarker, `${changelogMarker}${newSection}`);
        console.log(`Neuen Changelog-Block für Version ${currentVersion} erstellt.`);
    }

    fs.writeFileSync(README_PATH, content, 'utf8');

} catch (error) {
    console.error('Fehler beim Aktualisieren der README:', error.message);
    process.exit(1);
}
