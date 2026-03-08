/**
 * @file auto_version.js
 * @description Inkrementiert die Version, aktualisiert die CHANGELOG.md und 
 * synchronisiert die letzten 5 Einträge in die README.md (vor dem Annex).
 * @author Gemini 3 Flash
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hilfsfunktion zum Ausführen von Git-Befehlen
 * @param {string} command - Der auszuführende Befehl
 */
function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (err) {
        // Keine Punkte am Ende für ioBroker-Kompatibilität
        console.error(`❌ Git-Fehler bei Befehl: ${command}`, err.message);
        process.exit(1);
    }
}

// Prüfen auf main-Branch
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');
if (currentBranch !== 'main') {
    console.log(`ℹ️  Info: Branch ist "${currentBranch}" - Auto-Versionierung nur auf main`);
    process.exit(0);
}

const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

/**
 * Erhöht die Patch-Version (z.B. 1.0.12 -> 1.0.13)
 */
function incrementPatch(v) {
    const parts = v.split('.');
    if (parts.length === 3) {
        parts[2] = parseInt(parts[2], 10) + 1;
    }
    return parts.join('.');
}

/**
 * Ermittelt die Namen der geänderten Dateien
 */
function getChangedFilesList() {
    const files = runGitCommand('git diff --cached --name-only')
        .split('\n')
        .filter(f => {
            const name = f.trim();
            return name && 
                   !['package.json', 'CHANGELOG.md', 'README.md', 'io-package.json'].includes(name);
        })
        .map(f => `- Update von ${path.basename(f)}`);

    return files.length > 0 ? files.join('\n') : '- Allgemeine Code-Verbesserungen';
}

/**
 * Aktualisiert die README.md: Badge-Update und Changelog-Auszug (5 Einträge vor Annex)
 */
function updateReadme(newVersion) {
    if (!fs.existsSync(readmePath)) return;

    let readmeContent = fs.readFileSync(readmePath, 'utf8');
    const newBadge = `![Version](https://img.shields.io/badge/version-${newVersion}-orange)`;
    
    // 1. Badge-Update
    const anyVersionBadgeRegex = /!\[Version\]\(https:\/\/img\.shields\.io\/.*version.*\)/gi;
    readmeContent = readmeContent.replace(anyVersionBadgeRegex, '');
    const titleRegex = /^(# ioBroker Script-Sammlung\s*)/m;
    if (titleRegex.test(readmeContent)) {
        readmeContent = readmeContent.replace(titleRegex, `$1\n\n${newBadge} `);
    }

    // 2. Changelog-Synchronisation (5 Einträge)
    if (fs.existsSync(changelogPath)) {
        const fullChangelog = fs.readFileSync(changelogPath, 'utf8');
        const changelogEntries = fullChangelog.split('## [').slice(1, 6); // Top 5
        const latestChanges = '## 📜 Letzte Änderungen\n\n' + 
                             changelogEntries.map(e => '## [' + e).join('').trim();

        const startMarker = '';
        const endMarker = '';
        const changelogBlock = `${startMarker}\n\n${latestChanges}\n\n${endMarker}`;

        if (readmeContent.includes(startMarker) && readmeContent.includes(endMarker)) {
            const regex = new RegExp(`${startMarker}[\\s\\S]*${endMarker}`, 'g');
            readmeContent = readmeContent.replace(regex, changelogBlock);
        } else {
            // Vor dem Annex einfügen
            const annexRegex = /^(## .*Annex.*)$/m;
            if (annexRegex.test(readmeContent)) {
                readmeContent = readmeContent.replace(annexRegex, `---\n\n${changelogBlock}\n\n$1`);
            } else {
                readmeContent += `\n\n---\n\n${changelogBlock}`;
            }
        }
    }

    readmeContent = readmeContent.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(readmePath, readmeContent.trim() + '\n', 'utf8');
    runGitCommand(`git add "${readmePath}"`);
    console.log(`📖 README.md aktualisiert (5 Einträge vor Annex)`);
}

/**
 * Aktualisiert die CHANGELOG.md
 */
function updateChangelog(v) {
    const date = new Date().toISOString().split('T')[0];
    const fileList = getChangedFilesList();
    const newEntry = `## [${v}] - ${date}\n${fileList}\n\n`;
    
    let content = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
    const headerEnd = content.indexOf('\n\n') + 2;
    
    fs.writeFileSync(changelogPath, content.slice(0, headerEnd) + newEntry + content.slice(headerEnd));
    runGitCommand(`git add "${changelogPath}"`);
    console.log(`📝 CHANGELOG.md aktualisiert`);
}

// --- Hauptprozess ---
if (fs.existsSync(packagePath)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const oldV = pkg.version;
        const newV = incrementPatch(oldV);

        pkg.version = newV;
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
        runGitCommand(`git add "${packagePath}"`);
        console.log(`✅ package.json: ${oldV} -> ${newV}`);

        updateChangelog(newV);
        updateReadme(newV);

        console.log(`--- Erfolg: Version ${newV} ist bereit für den Commit ---`);
        process.exit(0);
    } catch (e) {
        console.error('❌ Fehler während des Updates:', e.message);
        process.exit(1);
    }
}