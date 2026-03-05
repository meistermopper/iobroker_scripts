/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC (STABLE, PERSISTENT & SHORTCUT-READY)
 * =============================================================================
 * VERSION: 2026-03-05 - Inkl. VS Code Shortcut-Trigger in VS Code
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const PATH_SCRIPTS = '/home/iobroker/scripts'; 
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';
const STATE_TRIGGER = '0_userdata.0.git_sync_trigger'; // Datenpunkt für VS Code Shortcut

// --- 2. INITIALISIERUNG (Datenpunkte prüfen/erstellen) ---

// Status-Datenpunkt für das Widget
if (!existsState(STATE_STATUS)) {
    createState(STATE_STATUS, "Initialisiert", {
        name: "Letzter Git-Sync Status",
        type: "string",
        role: "text"
    });
}

// Trigger-Datenpunkt für den VS Code Shortcut (Strg+Alt+S)
if (!existsState(STATE_TRIGGER)) {
    createState(STATE_TRIGGER, false, {
        name: "Trigger für GitHub Sync via VS Code",
        type: "boolean",
        role: "button",
        def: false,
        read: true,
        write: true
    });
}

// Gotify-Token Dummy (falls gar nichts existiert, damit das Skript nicht abbricht)
if (!existsState(GOTIFY_TOKEN_ID)) {
    createState(GOTIFY_TOKEN_ID, "", {
        name: "Gotify Token für Git-Sync",
        type: "string",
        role: "text"
    });
}

// --- 3. FUNKTIONEN ---

/**
 * Sendet Benachrichtigungen über Telegram, Gotify und setzt den Status
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
 * Hauptfunktion für den Git-Abgleich
 */
function runGitSync() {
    const exec = require('child_process').exec;
    const jetzt = new Date();
    // hh:mm sorgt für das korrekte Zeitformat im Widget [cite: 2026-03-05]
    const timestamp = formatDate(jetzt, "YYYY-MM-DD hh:mm");
    
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

// --- 4. TRIGGER & ABLAUF ---

// Täglicher Zeitplan um 00:07 Uhr [cite: 2026-02-16]
schedule("07 0 * * *", runGitSync);

// Automatischer Start-Sync nach 5 Sekunden beim Skriptstart [cite: 2026-03-05]
setTimeout(runGitSync, 5000);

// Reagiert auf den Shortcut-Trigger aus VS Code
on({id: STATE_TRIGGER, change: "any", val: true}, () => {
    log("[Git-Sync] Manueller Sync via VS Code Shortcut ausgelöst...");
    runGitSync();
    
    // Button nach 1 Sekunde automatisch zurücksetzen
    setTimeout(() => {
        setState(STATE_TRIGGER, false, true);
    }, 1000);
});

// --- 5. DAUERLAUF-FIX ---
/** * Dieser Block sorgt dafür, dass das Skript für ioBroker "aktiv" bleibt.
 */
on({id: "javascript.0.scriptEnabled." + name, change: "ne"}, () => {
    // Dummy-Funktion hält das Skript am Leben [cite: 2026-03-05]
});