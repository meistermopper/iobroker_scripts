/**
 * =============================================================================
 * GIT FULL-SYNC: 1:1 REPOSITORY-VERSION (MANUELLER TEST)
 * =============================================================================
 */

const PATH_SCRIPTS = '/home/iobroker/scripts'; 
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';

// Datenpunkt initialisieren
if (!existsState(STATE_STATUS)) {
    createState(STATE_STATUS, "Initialisiert", {
        name: "Letzter Git-Sync Status",
        type: "string",
        role: "text"
    });
}

/**
 * Kern-Funktion für die Synchronisation
 */
function doGitSync() {
    const exec = require('child_process').exec;
    
    // Zeitstempel generieren (Fix für das HH:07 Problem) [cite: 2026-03-03]
    const jetzt = new Date();
    const stunde = String(jetzt.getHours()).padStart(2, '0');
    const minute = String(jetzt.getMinutes()).padStart(2, '0');
    const datum = formatDate(jetzt, "YYYY-MM-DD");
    const timestamp = datum + " " + stunde + ":" + minute;
    
    log("[Git-Sync] Manuelle Synchronisation gestartet...", 'info');

    const cmd = "cd " + PATH_SCRIPTS + " && " +
                "git pull origin main && " +
                "git add . && " +
                "(git diff-index --quiet HEAD -- || git commit -m 'Auto-Sync: " + timestamp + "') && " +
                "git push origin main";
    
    exec(cmd, (error, stdout, stderr) => {
        const fullOutput = (stdout + stderr).toLowerCase();
        
        if (error && !fullOutput.includes("everything up-to-date") && !fullOutput.includes("already up to date")) {
            log("[Git-Sync] Kritischer Fehler: " + error.message, 'error');
            return;
        }

        let infoMsg = "";
        const hasLocalChanges = fullOutput.includes("file changed") || fullOutput.includes("files changed") || fullOutput.includes("delete mode");
        const hasRemoteUpdates = fullOutput.includes("updating") || fullOutput.includes("fast-forward");

        // ✅ wird jetzt immer vorangestellt, um den grünen Balken im Widget zu erzwingen [cite: 2026-03-03]
        if (hasLocalChanges || hasRemoteUpdates) {
            infoMsg = "✅ Sync erfolgreich (" + timestamp + ")";
        } else {
            infoMsg = "✅ Alles aktuell (" + timestamp + ")";
        }

        log("[Git-Sync] " + infoMsg, 'info');
        setState(STATE_STATUS, infoMsg, true);
    });
}

// 1. Zeitplan: Täglich um 00:07 Uhr [cite: 2026-02-16]
schedule("07 0 * * *", doGitSync);

// 2. SOFORT-START: Diese Zeile führt das Skript beim Speichern einmalig aus
doGitSync();