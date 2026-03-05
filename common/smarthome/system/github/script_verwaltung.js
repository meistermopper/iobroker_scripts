/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC (STABLE VERSION)
 * =============================================================================
 * VERSION: 2026-03-05 - Fix für automatischen Stopp
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const PATH_SCRIPTS = '/home/iobroker/scripts'; 
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';

// --- 2. INITIALISIERUNG ---
if (!existsState(STATE_STATUS)) {
    createState(STATE_STATUS, "Initialisiert", {
        name: "Letzter Git-Sync Status",
        type: "string",
        role: "text"
    });
}

/**
 * Funktion für Benachrichtigungen
 */
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

/**
 * Haupt-Sync Funktion
 */
function runGitSync() {
    const exec = require('child_process').exec;
    const timestamp = formatDate(new Date(), "YYYY-MM-DD HH:mm");
    
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
            log("[Git-Sync] Fehler: " + error.message, 'error');
            sendSyncNotify("⚠️ Fehler: " + error.message, 5);
            return;
        }

        const hasChanges = fullOutput.includes("changed") || fullOutput.includes("updating") || fullOutput.includes("fast-forward");

        if (hasChanges) {
            sendSyncNotify("✅ Sync erfolgreich am " + timestamp);
        } else {
            const statusMsg = "✅ Alles aktuell (" + timestamp + ")";
            log("[Git-Sync] " + statusMsg, 'info');
            setState(STATE_STATUS, statusMsg, true);
        }
    });
}

// --- 3. ABLAUFSTEUERUNG ---

// Täglicher Zeitplan
schedule("07 0 * * *", runGitSync);

// Einmaliger Start nach 5 Sekunden (erhöhte Verzögerung für Stabilität)
setTimeout(() => {
    log("[Git-Sync] Automatischer Start-Sync...", 'info');
    runGitSync();
}, 5000);