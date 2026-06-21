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
 * @returns {string|null} Eine Liste der Dateinamen oder null, wenn keine relevanten Änderungen vorliegen.
 */
function getChangedFilesList() {
    try {
        const files = runGitCommand('git diff --cached --name-only')
            .split('\n')
            .filter(f => {
                const name = f.trim();
                // Filter metadata, readmes, and version scripts
                return name && !['package.json', 'README.md', 'utils/auto_version.js', 'update_readme_changelog.js', 'CHANGELOG_OLD.md'].includes(name) && !name.startsWith('.iobroker');
            })
            .map(f => `- Update of ${path.basename(f)}`);

        return files.length > 0 ? files.join('\n') : null;
    } catch (e) {
        return null;
    }
}

// --- Hauptprozess ---
console.log('--- Start: Auto Versioning (Single Source of Truth) ---');

if (!fs.existsSync(packagePath)) {
    console.error('❌ Error: package.json not found');
    process.exit(1);
}
if (!fs.existsSync(readmePath)) {
    console.error('❌ Fehler: keine README.md gefunden');
    process.exit(1);
}

const fileList = getChangedFilesList();
if (!fileList) {
    console.log('ℹ️  No relevant script changes found - Skipping automatic versioning');
    process.exit(0);
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

    // 2c. Automatically limit README changelog to 5 entries and archive older ones
    const archiveMarker = 'Older entries can be found in the [Changelog Archive]';
    const changelogStartIndex = readmeContent.indexOf(changelogMarker);
    const archiveStartIndex = readmeContent.indexOf(archiveMarker);

    if (changelogStartIndex !== -1 && archiveStartIndex !== -1) {
        const changelogTextStart = changelogStartIndex + changelogMarker.length;
        const changelogText = readmeContent.substring(changelogTextStart, archiveStartIndex);
        const parts = changelogText.split('### [');

        if (parts.length > 6) {
            // Keep the first 5 entries (parts[1] to parts[5])
            const header = parts[0];
            const keepBlocks = parts.slice(1, 6).map(p => '### [' + p);
            const archiveBlocks = parts.slice(6).map(p => '### [' + p);

            // Reconstruct the new changelog text for README
            const newChangelogText = header + keepBlocks.join('');
            
            // Build the archived entries text to move to CHANGELOG_OLD.md
            const archivedText = archiveBlocks.join('');

            // Update README content
            readmeContent = readmeContent.substring(0, changelogTextStart) + newChangelogText + readmeContent.substring(archiveStartIndex);

            // Update CHANGELOG_OLD.md
            const oldChangelogPath = path.join(rootDir, 'CHANGELOG_OLD.md');
            if (!fs.existsSync(oldChangelogPath)) {
                fs.writeFileSync(oldChangelogPath, '# Changelog Archive\n\nThis archive contains older changelog entries for the ioBroker Script Collection.\n\n---\n', 'utf8');
            }

            let archiveContent = fs.readFileSync(oldChangelogPath, 'utf8');
            const markerIndex = archiveContent.indexOf('---');

            if (markerIndex !== -1) {
                const insertPos = markerIndex + '---'.length;
                const before = archiveContent.substring(0, insertPos);
                const after = archiveContent.substring(insertPos);
                const formattedArchiveText = '\n\n' + archivedText.trim() + '\n';
                archiveContent = before + formattedArchiveText + after.replace(/^\s+/, '\n');
            } else {
                archiveContent = archivedText + '\n' + archiveContent;
            }

            fs.writeFileSync(oldChangelogPath, archiveContent, 'utf8');
            console.log(`[Changelog] Archived ${archiveBlocks.length} older entry/entries to CHANGELOG_OLD.md`);
            
            // Stage CHANGELOG_OLD.md as well
            runGitCommand(`git add "${oldChangelogPath}"`);
        }
    }

    // 3. Aktualisierte README.md speichern und zu Git hinzufügen
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    runGitCommand(`git add "${readmePath}"`);

    console.log(`--- Success: Version ${newV} is ready for commit ---`);

} catch (e) {
    console.error('❌ Error during versioning:', e.message);
    process.exit(1);
}
