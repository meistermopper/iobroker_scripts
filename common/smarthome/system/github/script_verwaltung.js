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

schedule("38 8 * * *", () => {
    const exec = require('child_process').exec;
    const timestamp = formatDate(new Date(), "YYYY-MM-DD HH:mm");
    
    log(`[Git-Sync] Starte automatische Synchronisation...`, 'info');

    // Wir führen am Ende ein 'git status' aus, um die Rückmeldung zu erzwingen
    const cmd = `cd ${PATH_SCRIPTS} && git pull origin main && git add . && git commit -m "Auto-Sync: ${timestamp}" && git push origin main && git status`;
    
    exec(cmd, (error, stdout, stderr) => {
        // Wir fassen alles zusammen für die Analyse
        const fullOutput = (stdout + stderr).toLowerCase();
        
        if (error && !fullOutput.includes("nothing to commit")) {
            log(`[Git-Sync] Kritischer Fehler: ${error.message}`, 'error');
            sendSyncNotify(`⚠️ Fehler: ${error.message}`, 5);
            return;
        }

        let infoMsg = "";
        
        // Verbesserte Erkennung von Änderungen
        if (fullOutput.includes("file changed") || fullOutput.includes("files changed") || fullOutput.includes("insertions")) {
            infoMsg = `Erfolgreich: Lokale Änderungen hochgeladen (${timestamp})`;
            sendSyncNotify(`✅ ${infoMsg}`);
        } 
        else if (fullOutput.includes("updating") || fullOutput.includes("fast-forward")) {
            infoMsg = `Erfolgreich: Neue Daten von GitHub geladen (${timestamp})`;
            sendSyncNotify(`✅ ${infoMsg}`);
        } 
        else {
            infoMsg = `Synchronisation geprüft: Alles aktuell (${timestamp})`;
        }

        log(`[Git-Sync] ${infoMsg}`, 'info');
        setState(STATE_STATUS, infoMsg, true);
    });
});