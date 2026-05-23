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
    const commitMsg = execSync('git log -1 --pretty=%s').toString().trim();

    // NEU: Manueller Abbruch über die Commit-Nachricht (z.B. bei reinen Doku-Fixes)
    if (commitMsg.toLowerCase().includes('[skip log]') || commitMsg.toLowerCase().includes('[no changelog]')) {
        console.log('Update übersprungen: [skip log] Tag in Commit-Nachricht gefunden.');
        process.exit(0);
    }

    // 2. Aktuelle Version aus der package.json lesen
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    const currentVersion = pkg.version;

    // 2. Geänderte Dateien abrufen (nur .js Dateien)
    const changedFiles = execSync('git diff-tree --no-commit-id --name-only -r HEAD')
        .toString()
        .trim()
        .split('\n')
        .filter(f =>
            f.endsWith('.js') &&            // Nur JavaScript-Dateien
            !f.includes('node_modules') &&  // Keine Module
            !f.includes(path.basename(__filename)) // Das Skript ignoriert sich selbst
        );

    if (changedFiles.length === 0) {
        // Hier landen wir, wenn NUR die README.md oder andere Nicht-JS-Dateien geändert wurden
        console.log('Nur Dokumentation oder Systemdateien geändert. Changelog bleibt unverändert.');
        process.exit(0);
    }

    // 3. Changelog-Einträge vorbereiten
    const newEntries = changedFiles
        .map(f => `- Update von ${path.basename(f)} (${commitMsg})`)
        .join('\n');

    let content = fs.readFileSync(README_PATH, 'utf8');
    const today = new Date().toISOString().split('T')[0];

    // 4. Version im Badge aktualisieren (oben im README)
    // Sucht nach Version-X.X.X-success
    content = content.replace(/(Version-)(\d+\.\d+\.\d+)(-success)/, `$1${currentVersion}$3`);

    // 5. Neuen Versions-Block im Changelog einfügen
    // Wir suchen die Überschrift "## 📝 Changelog" und fügen den Block direkt darunter ein
    const changelogMarker = '## 📝 Changelog\n\n';
    const newSection = `### [${currentVersion}] - ${today}\n${newEntries}\n\n`;

    // Verhindert doppelte Einträge, falls der Hook mehrfach läuft
    if (content.includes(`### [${currentVersion}] - ${today}`) && content.includes(newEntries.split('\n')[0])) {
        console.log(`Eintrag für Version ${currentVersion} existiert bereits.`);
        process.exit(0);
    }

    const updatedContent = content.replace(changelogMarker, `${changelogMarker}${newSection}`);

    fs.writeFileSync(README_PATH, updatedContent, 'utf8');
    console.log(`README.md erfolgreich auf Version ${currentVersion} aktualisiert.`);

} catch (error) {
    console.error('Fehler beim Aktualisieren der README:', error.message);
    process.exit(1);
}
