/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC (BUGFIX-VERSION)
 * =============================================================================
 * - Fix: Ungültige IDs (The id "." is invalid) durch Filterung leerer Zeilen
 * - Fix: Nachrichten kommen nun auch bei "Alles aktuell"
 * - Logik: Turbo-Sync mit Priorität auf den Pull
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const PATH_SCRIPTS = '/home/iobroker/scripts';
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';
const STATE_TRIGGER = '0_userdata.0.git_sync_trigger';

/**
 * EIGENSICHERUNG:
 * Verhindert, dass das Skript sich selbst neu startet, wenn es sich per Git
 * aktualisiert hat (Endlosschleifen-Schutz).
 */
const SELF_NAME = 'common.smarthome.system.github.script_verwaltung';

// --- 2. BENACHRICHTIGUNGS-LOGIK ---

/**
 * Schickt Updates an das VIS-Widget, Telegram und Gotify.
 */
function sendSyncNotify(msg, priority = 1) {
    // Status im ioBroker-Datenpunkt setzen (für das VIS-Widget)
    setState(STATE_STATUS, msg, true);

    // Telegram-Nachricht absetzen
    sendTo('telegram', 'send', { text: "🔄 Git-Sync: " + msg });

    // Gotify-Nachricht absetzen (falls Token vorhanden)
    const tokenState = getState(GOTIFY_TOKEN_ID);
    if (tokenState && tokenState.val && tokenState.val.length > 5) {
        const url = "https://" + GOTIFY_SERVER + "/message?token=" + tokenState.val;
        const payload = {
            title: "ioBroker Sync",
            message: msg,
            priority: priority
        };
        const options = { timeout: 10000 }; // Erhöhtes Timeout, um den Fehler zu vermeiden

        httpPost(url, payload, options);
    }
}

// --- 3. RESTART-LOGIK ---

function restartAffectedScripts() {
    const exec = require('child_process').exec;
    const checkCmd = "cd " + PATH_SCRIPTS + " && git diff --name-only HEAD@{1} HEAD";

    exec(checkCmd, { timeout: 30000 }, (error, stdout) => {
        if (error) return;

        // Wir filtern leere Zeilen heraus, um den Fehler "The id '.' is invalid" zu vermeiden
        const changedFiles = stdout.split('\n').filter(line => line.trim() !== "");

        changedFiles.forEach(file => {
            if (file.endsWith('.js')) {
                // Pfad umwandeln: 'ordner/skript.js' -> 'ordner.skript'
                let scriptId = file.replace('.js', '').replace(/\//g, '.');

                // Überspringen, wenn es dieses Verwaltungs-Skript selbst ist
                if (scriptId === SELF_NAME) return;

                let fullPath = 'javascript.0.scriptEnabled.' + scriptId;

                if (existsState(fullPath)) {
                    log("[Git-Sync] Automatischer Neustart: " + scriptId);
                    setState(fullPath, false);
                    setTimeout(() => setState(fullPath, true), 1500);
                }
            }
        });
    });
}

// --- 4. SYNC-LOGIK ---

function runGitSync() {
    const exec = require('child_process').exec;
    const jetzt = new Date();
    // 'hh' sorgt für die korrekte 24h-Anzeige als Ziffern
    const timestamp = formatDate(jetzt, "YYYY-MM-DD hh:mm");

    log("[Git-Sync] Synchronisation gestartet...", 'info');

    // 1. SCHRITT: PULL (Daten vom Server holen)
    const pullCmd = "cd " + PATH_SCRIPTS + " && git pull origin main -s recursive -X ours";

    exec(pullCmd, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
            log("[Git-Sync] Fehler beim Pull: " + stderr, 'error');
            sendSyncNotify("❌ Fehler beim Pull (" + timestamp + ")", 2);
            return;
        }

        const fullOutput = (stdout + stderr).toLowerCase();
        const hasChanges = fullOutput.includes("changed") ||
                           fullOutput.includes("updating") ||
                           fullOutput.includes("fast-forward");

        if (hasChanges) {
            log("[Git-Sync] Änderungen gefunden. Starte Neustarts...");
            setTimeout(restartAffectedScripts, 1500);
            sendSyncNotify("✅ Update erfolgreich (" + timestamp + ")");
        } else {
            log("[Git-Sync] Alles aktuell.");
            // Optional: Nur noch im Log vermerken, aber keine Telegram/Gotify Nachricht senden
            // setState(STATE_STATUS, "✅ Alles aktuell (" + timestamp + ")", true);
        }

        // 2. SCHRITT: PUSH (Eigene Änderungen im Hintergrund hochladen)
        const pushCmd = "cd " + PATH_SCRIPTS + " && git add . && (git commit -m 'Auto-Sync: " + timestamp + "' || true) && git push origin main";
        exec(pushCmd, { timeout: 60000 });
    });
}

// --- 5. TRIGGER ---

// Nacht-Sync um 00:07 Uhr
schedule("07 0 * * *", runGitSync);

// Manueller Start (VS Code)
on({id: STATE_TRIGGER, change: "any", val: true}, () => {
    log("[Git-Sync] Manueller Start angefordert...");
    runGitSync();
    setTimeout(() => setState(STATE_TRIGGER, false, true), 1000);
});

// Fix für den Skript-Dauerlauf (Verwendet nun einen festen Namen statt der Variable 'name')
on({id: "javascript.0.scriptEnabled." + SELF_NAME, change: "ne"}, () => {});
