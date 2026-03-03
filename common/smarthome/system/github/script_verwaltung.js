/**
 * =============================================================================
 * GIT FULL-SYNC: DETAILLIERT KOMMENTIERTE PROFI-VERSION
 * =============================================================================
 * Dieses Skript synchronisiert lokale ioBroker-Skripte mit einem GitHub-Repository.
 * * OPTIMIERUNGEN:
 * 1. LÖSCH-SCHUTZ: Verwendet '--ignore-removal', um versehentliche Löschungen 
 * durch den ioBroker-Dateiwächter zu verhindern [cite: 2026-03-03].
 * 2. SILENT COMMIT: Vermeidet Fehlermeldungen bei "nichts zu committen" [cite: 2026-03-03].
 * 3. FEEDBACK: Schreibt Status-Updates in Datenpunkte, Telegram und Gotify.
 */

// --- Konfiguration ---
// Der absolute Pfad zu deinem Skript-Ordner auf dem Linux-System
const PATH_SCRIPTS = '/home/iobroker/scripts';

// IDs für die Benachrichtigungs-Dienste
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';

// Datenpunkt für den lesbaren Status (wird bei Bedarf automatisch angelegt)
const STATE_STATUS = '0_userdata.0.git_sync_last_status';

/**
 * Initialisierung:
 * Prüft beim Skriptstart, ob der Status-Datenpunkt existiert.
 */
if (!existsState(STATE_STATUS)) {
    createState(STATE_STATUS, "Noch nicht gelaufen", {
        name: "Letzter Git-Sync Status",
        type: "string",
        role: "text"
    });
}

/**
 * Funktion: sendSyncNotify
 * Zentralisiert den Versand von Nachrichten über verschiedene Kanäle.
 * @param {string} msg - Die Nachricht.
 * @param {number} priority - Gotify-Priorität (1-5).
 */
function sendSyncNotify(msg, priority = 1) {
    // 1. Status im ioBroker aktualisieren
    setState(STATE_STATUS, msg, true);
    
    // 2. Versand via Telegram
    sendTo('telegram', 'send', { text: `🔄 Git-Sync: ${msg}` });
    
    // 3. Versand via Gotify (falls Token vorhanden)
    const tokenState = getState(GOTIFY_TOKEN_ID);
    if (tokenState && tokenState.val) {
        httpPost(`https://${GOTIFY_SERVER}/message?token=${tokenState.val}`, {
            title: "ioBroker Sync",
            message: msg,
            priority: priority
        });
    }
}

/**
 * Zeitplan: Täglich um 00:07 Uhr
 */
schedule("07 0 * * *", () => {
    // Child_process laden für Shell-Befehle
    const exec = require('child_process').exec;
    
    // Zeitstempel für den Commit erzeugen
    const timestamp = formatDate(new Date(), "YYYY-MM-DD HH:mm");
    
    log(`[Git-Sync] Starte automatische Synchronisation...`, 'info');

    /**
     * Erklärung der optimierten Git-Befehlskette:
     * 1. cd: Wechselt ins Arbeitsverzeichnis.
     * 2. git pull: Holt Änderungen von GitHub.
     * 3. git add --ignore-removal .: WICHTIG! Fügt neue/geänderte Dateien hinzu,
     * ignoriert aber Dateien, die auf der Festplatte fehlen (Lösch-Schutz) [cite: 2026-03-03].
     * 4. git diff-index: Prüft lautlos, ob es echte Änderungen zum Committen gibt.
     * Verhindert den "Exit Code 1" Fehler bei leeren Commits [cite: 2026-03-03].
     * 5. git push: Schiebt die Änderungen hoch zu GitHub.
     */
    const cmd = `cd ${PATH_SCRIPTS} && \
                 git pull origin main && \
                 git add --ignore-removal . && \
                 (git diff-index --quiet HEAD -- || git commit -m "Auto-Sync: ${timestamp}") && \
                 git push origin main`;
    
    exec(cmd, (error, stdout, stderr) => {
        // Zusammenfassen der Ausgaben zur Analyse
        const fullOutput = (stdout + stderr).toLowerCase();
        
        /**
         * Fehlerbehandlung:
         * Ein 'error' wird ignoriert, wenn Git nur meldet, dass alles aktuell ist.
         */
        if (error && !fullOutput.includes("everything up-to-date") && !fullOutput.includes("already up to date")) {
            log(`[Git-Sync] Kritischer Fehler: ${error.message}`, 'error');
            sendSyncNotify(`⚠️ Fehler: ${error.message}`, 5);
            return;
        }

        let infoMsg = "";
        
        // Analyse: Gab es lokale Änderungen oder Remote-Updates?
        const hasLocalChanges = fullOutput.includes("file changed") || fullOutput.includes("files changed");
        const hasRemoteUpdates = fullOutput.includes("updating") || fullOutput.includes("fast-forward");

        if (hasLocalChanges && hasRemoteUpdates) {
            infoMsg = `Vollständiger Sync: Daten gesendet & empfangen (${timestamp})`;
            sendSyncNotify(`✅ ${infoMsg}`);
        } 
        else if (hasLocalChanges) {
            infoMsg = `Erfolgreich: Lokale Änderungen hochgeladen (${timestamp})`;
            sendSyncNotify(`✅ ${infoMsg}`);
        } 
        else if (hasRemoteUpdates) {
            infoMsg = `Erfolgreich: Neue Daten von GitHub geladen (${timestamp})`;
            sendSyncNotify(`✅ ${infoMsg}`);
        } 
        else {
            infoMsg = `Alles aktuell (${timestamp})`;
            // Wir loggen "Alles aktuell" nur in ioBroker, um Benachrichtigungs-Spam zu vermeiden
            log(`[Git-Sync] ${infoMsg}`, 'info');
            setState(STATE_STATUS, infoMsg, true);
        }
    });
});