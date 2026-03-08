/**
 * @file auto_version.js
 * @description Inkrementiert die Version und aktualisiert CHANGELOG.md sowie README.md (statisches Badge).
 * @author Gemini 3 Flash
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (err) {
        console.error(`❌ Git-Fehler: ${command}`, err.message);
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

function incrementPatch(v) {
    const p = v.split('.');
    if (p.length === 3) p[2] = parseInt(p[2], 10) + 1;
    return p.join('.');
}

/**
 * Aktualisiert das Badge in der README.md
 * Wir nutzen ein statisches Badge: https://img.shields.io/badge/version-1.0.5-orange
 */
function updateReadme(newVersion) {
    if (!fs.existsSync(readmePath)) return;

    let content = fs.readFileSync(readmePath, 'utf8');
    
    // Sucht nach dem Badge-Muster (egal welche Farbe oder Version gerade drin steht)
    const badgeRegex = /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[\d\.]+-orange\)/;
    const newBadge = `![Version](https://img.shields.io/badge/version-${newVersion}-orange)`;

    if (badgeRegex.test(content)) {
        // Bestehendes Badge ersetzen
        content = content.replace(badgeRegex, newBadge);
    } else {
        // Kein Badge gefunden? Dann unter die erste Überschrift einfügen
        content = content.replace(/^(# .*)$/m, `$1\n\n${newBadge}`);
    }

    fs.writeFileSync(readmePath, content, 'utf8');
    runGitCommand(`git add "${readmePath}"`);
    console.log(`📖 README.md: Badge auf ${newVersion} gesetzt.`);
}

function updateChangelog(v) {
    const date = new Date().toISOString().split('T')[0];
    const newEntry = `## [${v}] - ${date}\n- Automatisches Update.\n\n`;
    let content = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
    const headerEnd = content.indexOf('\n\n') + 2;
    fs.writeFileSync(changelogPath, content.slice(0, headerEnd) + newEntry + content.slice(headerEnd));
    runGitCommand(`git add "${changelogPath}"`);
}

// Hauptprozess
if (fs.existsSync(packagePath)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const newV = incrementPatch(pkg.version);

        pkg.version = newV;
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
        runGitCommand(`git add "${packagePath}"`);
        console.log(`✅ package.json: -> ${newV}`);

        updateChangelog(newV);
        updateReadme(newV);

        process.exit(0);
    } catch (e) {
        console.error('❌ Fehler:', e.message);
        process.exit(1);
    }
}