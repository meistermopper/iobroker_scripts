/**
 * @file auto_version.js
 * @description Inkrementiert die Patch-Version, aktualisiert die CHANGELOG.md 
 * und integriert das Version-Badge in der README.md.
 * * Dieses Skript ist so konzipiert, dass es ohne Benutzereingabe läuft,
 * damit es problemlos innerhalb der VS Code GUI funktioniert.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hilfsfunktion zum Ausführen von Shell-Befehlen (Git).
 * @param {string} command - Der auszuführende Befehl.
 * @returns {string} Die bereinigte Ausgabe des Befehls.
 */
function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (err) {
        console.error(`❌ Git-Fehler bei Befehl: ${command}`, err.message);
        process.exit(1); // Bei Fehlern brechen wir den Commit ab.
    }
}

// --- BRANCH-PRÜFUNG ---
// Wir ermitteln den aktuellen Branch-Namen, um sicherzustellen, 
// dass wir nur auf 'main' Versionen hochzählen.
const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD');

if (currentBranch !== 'main') {
    console.log(`ℹ️  Info: Branch ist "${currentBranch}". Auto-Versionierung nur auf "main".`);
    process.exit(0); 
}

// Verzeichnis-Definitionen
const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const readmePath = path.join(rootDir, 'README.md');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

/**
 * Erhöht die Patch-Stelle einer Version (z.B. 1.0.8 -> 1.0.9).
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
 * Aktualisiert die README.md: Entfernt alte Badges und setzt das neue 
 * orangefarbene Version-Badge an den Anfang der bestehenden Badge-Leiste.
 * @param {string} newVersion - Die neue Versionsnummer.
 */
function updateReadme(newVersion) {
    if (!fs.existsSync(readmePath)) return;

    let content = fs.readFileSync(readmePath, 'utf8');
    const newBadge = `![Version](https://img.shields.io/badge/version-${newVersion}-orange)`;
    
    // Regulärer Ausdruck, um alle alten Shields.io Versions-Badges zu finden.
    const anyVersionBadgeRegex = /!\[Version\]\(https:\/\/img\.shields\.io\/.*version.*\)/gi;

    // 1. Alle alten/kaputten Versions-Badges entfernen.
    content = content.replace(anyVersionBadgeRegex, '').trim();

    // 2. Bestehende Badge-Leiste finden (Status, Sprache, etc.).
    const badgeLineRegex = /(!\[.*\]\(https:\/\/img\.shields\.io\/.*\)\s*)+/g;
    const badgeMatch = content.match(badgeLineRegex);

    if (badgeMatch) {
        const oldBadgeLine = badgeMatch[0].trim();
        const newBadgeLine = `${newBadge} ${oldBadgeLine}`; 
        content = content.replace(oldBadgeLine, newBadgeLine);
    } else {
        // Fallback: Falls keine Leiste existiert, unter die Hauptüberschrift setzen.
        content = content.replace(/^(# .*)$/m, `$1\n\n${newBadge}`);
    }

    fs.writeFileSync(readmePath, content.trim() + '\n', 'utf8');
    runGitCommand(`git add "${readmePath}"`);
}

/**
 * Fügt einen neuen Standard-Eintrag oben in die CHANGELOG.md ein.
 * @param {string} v - Die neue Versionsnummer.
 */
function updateChangelog(v) {
    const date = new Date().toISOString().split('T')[0];
    const newEntry = `## [${v}] - ${date}\n- Automatisches Update der Version.\n\n`;
    
    let content = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n\n';
    
    // Den Eintrag direkt nach dem Header (Überschrift) einfügen.
    const headerEnd = content.indexOf('\n\n') + 2;
    const updatedContent = content.slice(0, headerEnd) + newEntry + content.slice(headerEnd);
    
    fs.writeFileSync(changelogPath, updatedContent, 'utf8');
    runGitCommand(`git add "${changelogPath}"`);
}

// --- HAUPT-LOGIK ---
console.log(`--- Start: Auto Versioning (Branch: ${currentBranch}) ---`);

if (fs.existsSync(packagePath)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const oldV = pkg.version;
        const newV = incrementPatch(oldV);

        // 1. package.json aktualisieren.
        pkg.version = newV;
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
        runGitCommand(`git add "${packagePath}"`);
        console.log(`✅ package.json: ${oldV} -> ${newV}`);

        // 2. Dokumentation (Changelog & README) aktualisieren.
        updateChangelog(newV);
        updateReadme(newV);

        console.log(`--- Erfolg: Version ${newV} bereit ---`);
        process.exit(0);
    } catch (e) {
        console.error('❌ Fehler während des Updates:', e.message);
        process.exit(1);
    }
} else {
    console.error('❌ Fehler: Keine package.json gefunden!');
    process.exit(1);
}