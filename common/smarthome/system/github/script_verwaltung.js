/**
 * =============================================================================
 * GIT FULL-SYNC: 1:1 REPOSITORY-VERSION (BEREINIGT)
 * =============================================================================
 * Dieses Skript synchronisiert lokale ioBroker-Skripte mit einem GitHub-Repository.
 * Es bildet den exakten lokalen Stand ab (inkl. Löschungen & Umbenennungen).
 * * VERSION: 2026-03-03 - Optimiert für ioBroker-Stabilität [cite: 2026-03-03]
 */

// --- 1. KONFIGURATION ---
const PATH_SCRIPTS = '/home/iobroker/scripts'; // Pfad auf dem Host
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';

// --- 2. INITIALISIERUNG ---
// Erstellt den Status-Datenpunkt, falls er noch nicht existiert [cite: 2026-02-23]
if (!existsState(STATE_STATUS)) {
    createState(STATE_STATUS, "Initialisiert", {
        name: "Letzter Git-Sync Status",
        type: "string",
        role: "text"
    });
}

/**
 * Funktion: sendSyncNotify
 * Versendet Statusmeldungen an ioBroker, Telegram und Gotify [cite: 2026-02-23].
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

// --- 3. DER SYNC-PROZESS ---
// Ausführung täglich um 00:07 Uhr [cite: 2026-02-16]
schedule("07 0 * * *", () => {
    const exec = require('child_process').exec;
    const timestamp = formatDate(new Date(), "YYYY-MM-DD HH:mm");
    
    log("[Git-Sync] Starte 1:1 Synchronisation...", 'info');

    /**
     * Erklärung der Befehlskette:
     * Wir nutzen hier die klassische Verkettung mit "+", um Probleme mit 
     * Zeilenumbrüchen im ioBroker-Editor zu vermeiden [cite: 2026-03-03].
     */
    const cmd = "cd " + PATH_SCRIPTS + " && " +
                "git pull origin main && " +
                "git add . && " +
                "(git diff-index --quiet HEAD -- || git commit -m 'Auto-Sync: " + timestamp + "') && " +
                "git push origin main";
    
    exec(cmd, (error, stdout, stderr) => {
        const fullOutput = (stdout + stderr).toLowerCase();
        
        // Fehlerprüfung: Ignoriere "Bereits aktuell"-Meldungen als Fehler [cite: 2026-03-03]
        if (error && !fullOutput.includes("everything up-to-date") && !fullOutput.includes("already up to date")) {
            log("[Git-Sync] Kritischer Fehler: " + error.message, 'error');
            sendSyncNotify("⚠️ Fehler: " + error.message, 5);
            return;
        }

        let infoMsg = "";
        
        // Analyse der Git-Ausgabe für die Erfolgsmeldung [cite: 2026-02-23]
        const hasLocalChanges = fullOutput.includes("file changed") || fullOutput.includes("files changed") || fullOutput.includes("delete mode");
        const hasRemoteUpdates = fullOutput.includes("updating") || fullOutput.includes("fast-forward");

        if (hasLocalChanges && hasRemoteUpdates) {
            infoMsg = "Vollständiger Sync: Daten gesendet & empfangen (" + timestamp + ")";
            sendSyncNotify("✅ " + infoMsg);
        } else if (hasLocalChanges) {
            infoMsg = "Erfolgreich: Lokale Änderungen/Löschungen hochgeladen (" + timestamp + ")";
            sendSyncNotify("✅ " + infoMsg);
        } else if (hasRemoteUpdates) {
            infoMsg = "Erfolgreich: Neue Daten von GitHub geladen (" + timestamp + ")";
            sendSyncNotify("✅ " + infoMsg);
        } else {
            infoMsg = "Alles aktuell (" + timestamp + ")";
            log("[Git-Sync] " + infoMsg, 'info');
            setState(STATE_STATUS, infoMsg, true);
        }
    });
});