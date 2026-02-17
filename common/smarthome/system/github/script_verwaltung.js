// =============================================================================
// GIT FULL-SYNC: ZWEI-WEGE-SYNCHRONISATION (GITHUB <-> IOBROKER)
// =============================================================================

// Konfiguration
const PATH_SCRIPTS = '/home/iobroker/scripts';
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status'; // Neuer Status-Datenpunkt

// Datenpunkt erstellen, falls er nicht existiert
if (!existsState(STATE_STATUS)) {
    createState(STATE_STATUS, "Noch nicht gelaufen", {
        name: "Letzter Git-Sync Status",
        type: "string",
        role: "text"
    });
}

function sendSyncNotify(msg, priority = 1) {
    setState(STATE_STATUS, msg, true); // Status im Datenpunkt aktualisieren
    
    sendTo('telegram', 'send', { text: `🔄 Git-Sync: ${msg}` });
    
    const tokenState = getState(GOTIFY_TOKEN_ID);
    if (tokenState && tokenState.val) {
        httpPost(`https://${GOTIFY_SERVER}/message?token=${tokenState.val}`, {
            title: "ioBroker Sync",
            message: msg,
            priority: priority
        });
    }
}

schedule("30 8 * * *", () => {
    const exec = require('child_process').exec;
    const timestamp = formatDate(new Date(), "YYYY-MM-DD hh:mm");
    
    log(`[Git-Sync] Starte automatische Synchronisation...`, 'info');

    const cmd = `cd ${PATH_SCRIPTS} && git pull origin main && git add . && git commit -m "Auto-Sync: ${timestamp}" && git push origin main`;
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            if (error.message.includes("nothing to commit")) {
                const msg = `Alles aktuell (nichts zu committen) am ${timestamp}`;
                log(`[Git-Sync] ${msg}`, 'info');
                setState(STATE_STATUS, msg, true);
            } else {
                log(`[Git-Sync] Kritischer Fehler: ${error.message}`, 'error');
                sendSyncNotify(`⚠️ Fehler: ${error.message}`, 5);
                return;
            }
        } else {
            // Erfolgsauswertung
            let infoMsg = "";
            if (stdout.includes("Updating") || stdout.includes("Fast-forward")) {
                infoMsg = `Erfolgreich: Neue Daten von GitHub geladen (${timestamp})`;
            } else if (stdout.includes("file changed")) {
                infoMsg = `Erfolgreich: Lokale Änderungen hochgeladen (${timestamp})`;
            } else {
                infoMsg = `Synchronisation geprüft: Alles aktuell (${timestamp})`;
            }

            log(`[Git-Sync] ${infoMsg}`, 'info');
            setState(STATE_STATUS, infoMsg, true);

            // Benachrichtigung nur bei echten Änderungen
            if (stdout.includes("Updating") || stdout.includes("file changed")) {
                sendSyncNotify(`✅ ${infoMsg}`);
            }
        }
    });
});