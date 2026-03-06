/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC (PRO-VERSION: AUTO-RESTART & PERSISTENCE)
 * =============================================================================
 * VERSION: 2026-03-06 - Fix für verschwindende & stoppende Skripte 
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const PATH_SCRIPTS = '/home/iobroker/scripts'; 
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';
const STATE_TRIGGER = '0_userdata.0.git_sync_trigger';

// --- 2. INITIALISIERUNG ---

if (!existsState(STATE_STATUS)) {
    createState(STATE_STATUS, "Initialisiert", { name: "Letzter Git-Sync Status", type: "string", role: "text" });
}

if (!existsState(STATE_TRIGGER)) {
    createState(STATE_TRIGGER, false, { name: "Trigger für GitHub Sync via VS Code", type: "boolean", role: "button" });
}

// --- 3. HELFER-FUNKTIONEN ---

/**
 * Sendet Benachrichtigungen und setzt den Status-Datenpunkt
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
 * Erzwingt den Neustart von Skripten, die sich geändert haben könnten.
 * Dies verhindert, dass Skripte nach dem Sync im Status "stopped" bleiben.
 */
function restartAffectedScripts() {
    const exec = require('child_process').exec;
    
    // Wir fragen Git, welche Dateien sich im Vergleich zum Stand VOR dem Sync geändert haben
    // HEAD@{1} ist der Zustand vor dem letzten Pull/Commit
    const checkCmd = "cd " + PATH_SCRIPTS + " && git diff --name-only HEAD@{1} HEAD";

    exec(checkCmd, (error, stdout) => {
        if (error) return;

        const changedFiles = stdout.split('\n');
        changedFiles.forEach(file => {
            if (file.endsWith('.js')) {
                // Pfad umwandeln: 'common/ordner/skript.js' -> 'common.ordner.skript'
                let scriptId = file.replace('.js', '').replace(/\//g, '.');
                let fullPath = 'javascript.0.scriptEnabled.' + scriptId;

                if (existsState(fullPath)) {
                    log("[Git-Sync] Erneutes Starten von: " + scriptId, 'info');
                    
                    // Einmal Aus- und wieder Einschalten erzwingt den sauberen Start
                    setState(fullPath, false);
                    setTimeout(() => {
                        setState(fullPath, true);
                    }, 1000);
                }
            }
        });
    });
}

/**
 * Hauptfunktion für den Git-Abgleich
 */
function runGitSync() {
    const exec = require('child_process').exec;
    const jetzt = new Date();
    const timestamp = formatDate(jetzt, "YYYY-MM-DD HH:mm");
    
    log("[Git-Sync] Synchronisation wird gestartet...", 'info');

    // Erläuterung der Kette:
    // 1. Alle lokalen Änderungen merken (add)
    // 2. Beiseite schieben (stash), damit der Pull sauber durchgeht
    // 3. Neue Version holen (pull)
    // 4. Eigene Änderungen wieder drüberlegen (pop)
    // 5. Alles wieder hinzufügen und für den Server commiten & pushen
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
        
        // Prüfung auf Fehler (außer es war ohnehin alles aktuell)
        if (error && !fullOutput.includes("up-to-date") && !fullOutput.includes("no local changes")) {
            log("[Git-Sync] Fehler/Warnung während Sync: " + error.message, 'warn');
        }

        const hasChanges = fullOutput.includes("changed") || 
                           fullOutput.includes("updating") || 
                           fullOutput.includes("fast-forward");

        if (hasChanges) {
            sendSyncNotify("✅ Sync erfolgreich am " + timestamp);
            // WICHTIG: Nach dem Sync prüfen, was neu gestartet werden muss
            setTimeout(restartAffectedScripts, 3000);
        } else {
            const statusMsg = "✅ Alles aktuell (" + timestamp + ")";
            log("[Git-Sync] " + statusMsg, 'info');
            setState(STATE_STATUS, statusMsg, true);
        }
    });
}

// --- 4. TRIGGER & ABLAUF ---

// Täglicher Zeitplan um 00:07 Uhr
schedule("07 0 * * *", runGitSync);

// Automatischer Start-Sync beim Skriptstart
setTimeout(runGitSync, 5000);

// Reagiert auf den Shortcut-Trigger aus VS Code
on({id: STATE_TRIGGER, change: "any", val: true}, () => {
    log("[Git-Sync] Manueller Sync via VS Code Shortcut ausgelöst...");
    runGitSync();
    
    setTimeout(() => {
        setState(STATE_TRIGGER, false, true);
    }, 1000);
});

// --- 5. DAUERLAUF-FIX ---
// Hält das Verwaltungsskript im ioBroker-Speicher aktiv
on({id: "javascript.0.scriptEnabled." + name, change: "ne"}, () => {});