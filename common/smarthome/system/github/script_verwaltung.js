/**
 * =============================================================================
<<<<<<< Updated upstream
 * ioBroker GIT FULL-SYNC (STABLE, PERSISTENT & SHORTCUT-READY)
 * =============================================================================
 * VERSION: 2026-03-05 - Shortcut-Trigger in VS Code entfernt
=======
 * ioBroker GIT FULL-SYNC: 1:1 REPOSITORY-STEUERUNG (LOCAL-WINS EDITION)
 * =============================================================================
 * Dieses Skript synchronisiert lokale ioBroker-Skripte mit GitHub.
 * Es ist so konfiguriert, dass lokale Änderungen Vorrang haben (Conflict-Safe).
 * * FUNKTIONEN:
 * 1. Täglicher automatischer Sync um 00:07 Uhr.
 * 2. Automatischer Sync direkt beim Skriptstart/Speichern (2s Verzögerung).
 * 3. Automatisches Stashing & Merging bei Konflikten (Local-Wins).
 * 4. Statusmeldungen via ioBroker-Log, Telegram und Gotify.
 * * VERSION: 2026-03-04 - Optimiert für automatische Konfliktlösung
>>>>>>> Stashed changes
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
<<<<<<< Updated upstream
const PATH_SCRIPTS = '/home/iobroker/scripts'; 
=======
// Pfad zum Skript-Ordner auf deinem ioBroker-Host
const PATH_SCRIPTS = '/home/iobroker/scripts'; 

// Datenpunkte für Benachrichtigungen & Status
>>>>>>> Stashed changes
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';
const STATE_TRIGGER = '0_userdata.0.git_sync_trigger'; // Datenpunkt für VS Code Shortcut

<<<<<<< Updated upstream
// --- 2. INITIALISIERUNG (Datenpunkte prüfen/erstellen) ---

// Status-Datenpunkt für das Widget
=======
// --- 2. INITIALISIERUNG ---
// Erstellt den Status-Datenpunkt, falls er noch nicht existiert
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
 * Sendet Benachrichtigungen über Telegram, Gotify und setzt den Status
=======
 * Funktion: sendSyncNotify
 * Zentralisiert den Versand von Statusmeldungen an alle Kanäle.
 * @param {string} msg - Die Nachricht, die gesendet werden soll.
 * @param {number} priority - Gotify-Priorität (1 = Info, 5 = Alarm).
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
/**
 * Hauptfunktion für den Git-Abgleich
=======
// --- 3. DIE SYNC-FUNKTION (KERNLOGIK) ---

/**
 * Funktion: runGitSync
 * Führt die Git-Befehlskette mit automatischer Konfliktlösung aus.
>>>>>>> Stashed changes
 */
function runGitSync() {
    const exec = require('child_process').exec;
    const jetzt = new Date();
    // hh:mm sorgt für das korrekte Zeitformat im Widget [cite: 2026-03-05]
    const timestamp = formatDate(jetzt, "YYYY-MM-DD hh:mm");
    
    log("[Git-Sync] Synchronisation wird gestartet...", 'info');

<<<<<<< Updated upstream
=======
    /**
     * Erklärung der robusten Befehlskette:
     * 1. git add . && git stash: Lokale Änderungen sicher zwischenparken.
     * 2. git pull ... -X ours: GitHub-Stand holen. Bei Konflikten bleibt die lokale Version ('ours') erhalten.
     * 3. git stash pop: Geparkte Änderungen wieder einspielen (Konflikte werden ignoriert).
     * 4. git add . && commit: Finalen Stand für den Upload vorbereiten.
     * 5. git push: Den sauberen Stand zurück zu GitHub schieben.
     */
>>>>>>> Stashed changes
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
        
<<<<<<< Updated upstream
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
=======
        // Fehlerprüfung: Ignoriere Standard-Meldungen, die keine echten Fehler sind
        if (error && !fullOutput.includes("everything up-to-date") && !fullOutput.includes("already up to date") && !fullOutput.includes("no local changes to save")) {
            log("[Git-Sync] Kritischer Fehler: " + error.message, 'error');
            sendSyncNotify("⚠️ Fehler: " + error.message, 5);
            return;
        }

        // Erfolgskontrolle
        const hasLocalChanges = fullOutput.includes("file changed") || fullOutput.includes("files changed") || fullOutput.includes("delete mode") || fullOutput.includes("dropped refs");
        const hasRemoteUpdates = fullOutput.includes("updating") || fullOutput.includes("fast-forward");

        if (hasLocalChanges || hasRemoteUpdates) {
            sendSyncNotify("✅ Sync erfolgreich (Konflikte gelöst) am " + timestamp);
        } else {
            log("[Git-Sync] Alles aktuell (" + timestamp + ")", 'info');
            setState(STATE_STATUS, "Alles aktuell (" + timestamp + ")", true);
>>>>>>> Stashed changes
        }
    });
}

<<<<<<< Updated upstream
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
=======
// --- 4. TRIGGER & AUTOMATISIERUNG ---

// A. Geplante Ausführung: Täglich um 00:07 Uhr
schedule("07 0 * * *", runGitSync);

// B. Sofortige Ausführung beim Skript-Start / Speichern
// Wartet 2 Sekunden, um Initialisierungen abzuschließen
setTimeout(() => {
    log("[Git-Sync] Initialer Start-Sync wird ausgeführt...", 'info');
    runGitSync();
}, 2000);
>>>>>>> Stashed changes
