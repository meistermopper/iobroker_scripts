/**
 * @file auto_version.js
 * @description Inkrementiert die Version und sortiert das Version-Badge 
 * sauber in die bestehende Badge-Leiste der README.md ein.
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
        console.error(`❌ Git-Fehler: ${command}`, err.message);
        process.exit(1);
    }
}

// 1. Branche prüfen: Nur auf 'main' aktiv werden
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');
if (currentBranch !== 'main') process.exit(0);

const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

/**
 * Erhöht die Patch-Version (x.x.1 -> x.x.2)
 */
function incrementPatch(v) {
    const p = v.split('.');
    if (p.length === 3) p[2] = parseInt(p[2], 10) + 1;
    return p.join('.');
}

/**
 * Aktualisiert die README.md und sortiert das Badge in die Leiste ein
 */
function updateReadme(newVersion) {
    if (!fs.existsSync(readmePath)) return;

    let content = fs.readFileSync(readmePath, 'utf8');
    const newBadge = `![Version](https://img.shields.io/badge/version-${newVersion}-orange)`;
    
    // Regex für ALLE Arten von Versions-Badges (alt, kaputt oder statisch)
    const anyVersionBadgeRegex = /!\[Version\]\(https:\/\/img\.shields\.io\/.*version.*\)/gi;

    // 1. Zuerst alle alten Versions-Badges restlos entfernen (auch Zeilenumbrüche danach)
    content = content.replace(anyVersionBadgeRegex, '').trim();

    // 2. Die Badge-Leiste finden. Wir suchen nach einer Zeile, die bereits Shields.io Badges enthält.
    // In deinem Fall: ![Status]... ![Sprache]...
    const badgeLineRegex = /(!\[.*\]\(https:\/\/img\.shields\.io\/.*\)\s*)+/g;
    const badgeMatch = content.match(badgeLineRegex);

    if (badgeMatch) {
        // Wir nehmen die erste Badge-Leiste, die wir finden
        const oldBadgeLine = badgeMatch[0].trim();
        const newBadgeLine = `${newBadge} ${oldBadgeLine}`; // Version ganz nach vorne setzen
        
        content = content.replace(oldBadgeLine, newBadgeLine);
    } else {
        // Falls gar keine Leiste gefunden wurde, setzen wir es unter die Hauptüberschrift
        content = content.replace(/^(# .*)$/m, `$1\n\n${newBadge}`);
    }

    // 3. Datei speichern und für Git markieren
    fs.writeFileSync(readmePath, content.trim() + '\n', 'utf8');
    runGitCommand(`git add "${readmePath}"`);
    console.log(`📖 README.md: Version ${newVersion} in die Badge-Leiste integriert.`);
}

/**
 * Schreibt den Eintrag in die CHANGELOG.md
 */
function updateChangelog(v) {
    const date = new Date().toISOString().split('T')[0];
    const newEntry = `## [${v}] - ${date}\n- Automatisches Update.\n\n`;
    let content = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
    const headerEnd = content.indexOf('\n\n') + 2;
    fs.writeFileSync(changelogPath, content.slice(0, headerEnd) + newEntry + content.slice(headerEnd));
    run