/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC (STABLE & PERSISTENT)
 * =============================================================================
 * VERSION: 2026-03-05 - Fix für Status "Grün" & Zeitstempel
 * =============================================================================
 */

const PATH_SCRIPTS = '/home/iobroker/scripts'; 
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';

// --- 1. INITIALISIERUNG ---
if (!existsState(STATE_STATUS)) {
    createState(STATE_STATUS, "Initialisiert", {
        name: "Letzter Git-Sync Status",
        type: "string",
        role: "text"
    });
}

// --- 2. FUNKTIONEN ---

function sendSyncNotify(msg, priority = 1) {
    setState(STATE_STATUS, msg, true);
    sendTo('telegram', 'send', { text: "🔄 Git-Sync: " + msg });
    
    const tokenState = getState(GOTIFY_TOKEN_ID);
    if (tokenState && tokenState.val) {
        httpPost("https://" + GOTIFY_SERVER + "/message?token=" + tokenState.val, {
            title: "ioBroker Sync",
            message: msg,
            priority: priority
        });
    }
}

function runGitSync() {
    const exec = require('child_process').exec;
    const jetzt = new Date();
    // Wichtig: HH:mm sorgt für 24h-Format (vermeidet den "HH:27" Fehler) [cite: 2026-03-05]
    const timestamp = formatDate(jetzt, "YYYY-MM-DD HH:mm");
    
    log("[Git-Sync] Synchronisation wird gestartet...", 'info');

    const cmd = "cd " + PATH_SCRIPTS + " && " +
                "git add . && " +
                "git stash && " +
                "git pull origin main -s recursive -X ours && " +
                "git stash pop || true && " +
                "git add . && " +
                "(git diff-index --quiet HEAD -- || git commit -m 'Auto-Sync: " + timestamp + "') && " +
                "git push origin main";
    
    exec(cmd, (error, stdout, stderr) => {
        const fullOutput = (stdout + stderr).toLowerCase();
        
        if (error && !fullOutput.includes("up-to-date") && !fullOutput.includes("no local changes")) {
            log("[Git-Sync] Warnung während Sync: " + error.message, 'warn');
        }

        const hasChanges = fullOutput.includes("changed") || fullOutput.includes("updating") || fullOutput.includes("fast-forward") || fullOutput.includes("dropped refs");

        if (hasChanges) {
            sendSyncNotify("✅ Sync erfolgreich am " + timestamp);
        } else {
            const statusMsg = "✅ Alles aktuell (" + timestamp + ")";
            log("[Git-Sync] " + statusMsg, 'info');
            setState(STATE_STATUS, statusMsg, true);
        }
    });
}

// --- 3. TRIGGER & ABLAUF ---

// Täglicher Zeitplan um 00:07 Uhr [cite: 2026-02-16]
schedule("07 0 * * *", runGitSync);

// Automatischer Start nach 5 Sekunden [cite: 2026-03-05]
setTimeout(runGitSync, 5000);

// --- 4. DAUERLAUF-FIX ---
/** * Dieser Block sorgt dafür, dass das Skript für ioBroker "aktiv" bleibt.
 * Wir abonnieren den Status dieses Skripts selbst. 
 */
on({id: "javascript.0.scriptEnabled." + name, change: "ne"}, () => {
    // Dummy-Funktion hält das Skript am Leben
});