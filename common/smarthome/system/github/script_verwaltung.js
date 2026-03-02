/**
 * =============================================================================
 * GIT FULL-SYNC: DETAILLIERT KOMMENTIERTE VERSION
 * =============================================================================
 * Dieses Skript synchronisiert lokale ioBroker-Skripte mit einem GitHub-Repository.
 * Es ist darauf optimiert, unnötige Fehlermeldungen (wie "nichts zu committen")
 * zu vermeiden und klare Rückmeldungen in ioBroker-Datenpunkte zu schreiben.
 */

// --- Konfiguration ---
// Der absolute Pfad zu deinem Skript-Ordner auf dem Dateisystem
const PATH_SCRIPTS = '/home/iobroker/scripts';

// IDs für die Benachrichtigungs-Dienste
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';

// Datenpunkt, in dem der lesbare Status der letzten Synchronisation gespeichert wird
const STATE_STATUS = '0_userdata.0.git_sync_last_status';

/**
 * Initialisierung:
 * Prüft beim Skriptstart, ob der Status-Datenpunkt existiert.
 * Falls nicht, wird er mit Standardwerten angelegt.
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
 * Zentralisiert den Versand von Nachrichten über Telegram und Gotify.
 * @param {string} msg - Die Nachricht, die gesendet werden soll.
 * @param {number} priority - Gotify-Priorität (1 = Info, 5 = Kritisch).
 */
function sendSyncNotify(msg, priority = 1) {
    // 1. Status im ioBroker-Objektbaum aktualisieren (bestätigt mit "true")
    setState(STATE_STATUS, msg, true);
    
    // 2. Versand via Telegram
    sendTo('telegram', 'send', { text: `🔄 Git-Sync: ${msg}` });
    
    // 3. Versand via Gotify (falls Token vorhanden)
    const tokenState = getState(GOTIFY_TOKEN_ID);
    if (tokenState && tokenState.val) {
        // HTTP-Post an deinen eigenen Gotify-Server
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
    // Child_process laden, um Shell-Befehle auszuführen
    const exec = require('child_process').exec;
    
    // Zeitstempel für den Commit und die Logs erzeugen (24h-Format)
    const timestamp = formatDate(new Date(), "YYYY-MM-DD HH:mm");
    
    log(`[Git-Sync] Starte automatische Synchronisation...`, 'info');

    /**
     * Erklärung der Git-Befehlskette:
     * 1. cd: Wechselt ins Verzeichnis.
     * 2. git pull: Holt Änderungen von GitHub (main-Branch).
     * 3. git add .: Fügt alle neuen/geänderten Dateien der Stage hinzu.
     * 4. git diff-index: Prüft leise, ob es Unterschiede zum letzten Commit gibt.
     * - Falls JA: Führt git commit aus.
     * - Falls NEIN: Überspringt den Commit sauber ohne Fehlermeldung.
     * 5. git push: Schiebt alles hoch zu GitHub.
     */
    const cmd = `cd ${PATH_SCRIPTS} && \
                 git pull origin main && \
                 git add . && \
                 (git diff-index --quiet HEAD -- || git commit -m "Auto-Sync: ${timestamp}") && \
                 git push origin main`;
    
    // Ausführung des Befehls auf Systemebene
    exec(cmd, (error, stdout, stderr) => {
        // Kombiniert Standard-Output und Fehlerausgabe zur Analyse
        const fullOutput = (stdout + stderr).toLowerCase();
        
        /**
         * Fehlerbehandlung:
         * Ein 'error' wird nur dann als kritisch gewertet, wenn Git nicht meldet,
         * dass eigentlich alles "up to date" (aktuell) ist.
         */
        if (error && !fullOutput.includes("everything up-to-date") && !fullOutput.includes("already up to date")) {
            log(`[Git-Sync] Kritischer Fehler: ${error.message}`, 'error');
            sendSyncNotify(`⚠️ Fehler: ${error.message}`, 5);
            return;
        }

        let infoMsg = "";
        
        // Prüfung: Wurden lokal Dateien geändert und committed?
        const hasLocalChanges = fullOutput.includes("file changed") || fullOutput.includes("files changed");
        
        // Prüfung: Gab es Updates vom GitHub-Server (Remote)?
        const hasRemoteUpdates = fullOutput.includes("updating") || fullOutput.includes("fast-forward");

        // Logik zur Bestimmung der Erfolgsmeldung
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
            // Fall: Es gab weder lokal noch remote etwas zu tun
            infoMsg = `Alles aktuell (${timestamp})`;
        }

        // Abschluss-Log in ioBroker schreiben
        log(`[Git-Sync] ${infoMsg}`, 'info');
        setState(STATE_STATUS, infoMsg, true);
    });
});