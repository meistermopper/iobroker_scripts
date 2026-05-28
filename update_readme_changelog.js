/**
 * README Changelog Updater
 * Automates the addition of commit comments to README.md
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// 0. Loop Protection: Prevent recursion if called via git hooks
if (process.env.SKIP_CHANGELOG_HOOK === '1') {
    process.exit(0);
}

const README_PATH = path.join(__dirname, 'README.md');
const PKG_PATH = path.join(__dirname, 'package.json');

// Files that should never appear in the changelog
const EXCLUDE_LIST = [path.basename(__filename), 'package.json', 'package-lock.json', 'README.md'];

try {
    // 1. Get the latest commit hash and message
    let fullMsg = execSync('git log -1 --pretty=%B').toString().trim();
    // Extract first line and clean quotes
    let commitMsg = fullMsg.split('\n')[0].trim();
    commitMsg = commitMsg.replace(/^["']|["']$/g, '');

    // Manual skip via commit message tag
    if (commitMsg.toLowerCase().includes('[skip log]') || commitMsg.toLowerCase().includes('[no changelog]')) {
        console.log('[Changelog] Skipping update: [skip log] tag found.');
        process.exit(0);
    }

    // 2. Read version from package.json
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    const currentVersion = pkg.version;

    // 3. Retrieve changed files (JS scripts in subfolders only)
    const changedFiles = execSync('git diff-tree --no-commit-id --name-only -r HEAD')
        .toString()
        .trim()
        .split('\n')
        .filter(f => {
            if (!f) return false;
            const fileName = path.basename(f);
            const isJs = f.endsWith('.js');
            const isInSubfolder = f.includes('/') || f.includes('\\');
            const isExcluded = EXCLUDE_LIST.includes(fileName) || f.toLowerCase().includes('node_modules');

            if (isJs && !isInSubfolder) console.log(`[Changelog] Skipping root file: ${fileName}`);
            if (isExcluded) console.log(`[Changelog] Ignoring system file: ${fileName}`);

            return isJs && isInSubfolder && !isExcluded;
        });

    if (changedFiles.length === 0) {
        console.log('[Changelog] No relevant script changes found in this commit.');
        process.exit(0);
    }

    // 4. Prepare entries: One line per commit, grouping files
    const fileList = changedFiles.map(f => path.basename(f)).join(', ');
    const newEntry = `- ${commitMsg} (${fileList})`;

    let content = fs.readFileSync(README_PATH, 'utf8');
    const today = new Date().toISOString().split('T')[0];
    const versionHeader = `### [${currentVersion}] - ${today}`;

    // 5. Update Version Badge
    content = content.replace(/(Version-)(\d+\.\d+\.\d+)(-success)/, `$1${currentVersion}$3`);

    const changelogMarker = '## 📝 Changelog';

    // 6. Logic: Handle existing or new version blocks
    if (content.includes(versionHeader)) {
        const lines = content.split('\n');
        const headerIndex = lines.findIndex(l => l.includes(versionHeader));

        // Check if this specific entry already exists for today
        const entryExists = lines.some((line, index) => index > headerIndex && line.includes(commitMsg));

        if (!entryExists) {
            lines.splice(headerIndex + 1, 0, newEntry);
            content = lines.join('\n');
            console.log(`[Changelog] Added entry to existing version ${currentVersion}.`);
        } else {
            console.log('[Changelog] Entry already exists in README.');
            process.exit(0);
        }
    } else {
        // Create a new version block
        const newSection = `\n\n${versionHeader}\n${newEntry}`;
        content = content.replace(changelogMarker, `${changelogMarker}${newSection}`);
        console.log(`[Changelog] Created new block for version ${currentVersion}.`);
    }

    fs.writeFileSync(README_PATH, content, 'utf8');
    console.log(`[Changelog] README.md successfully updated to version ${currentVersion}.`);

    // 7. ATOMIC UPDATE: Amend the commit to include the README changes
    execSync(`git add "${README_PATH}"`);

    execSync('git commit --amend --no-edit', {
        env: { ...process.env, SKIP_CHANGELOG_HOOK: '1' },
        stdio: 'inherit'
    });

    console.log(`[Changelog] Commit amended with README update. Ready to sync.`);

} catch (error) {
    console.error('[Changelog] Error updating README:', error.message);
    process.exit(1);
}
