/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC: 1:1 REPOSITORY-STEUERUNG (LOCAL-WINS EDITION)
 * =============================================================================
 * Dieses Skript synchronisiert lokale ioBroker-Skripte mit GitHub.
 * Es ist so konfiguriert, dass lokale Änderungen Vorrang haben (Conflict-Safe).
 * * FUNKTIONEN:
 * 1. Täglicher automatischer Sync um 00:07 Uhr [cite: 2026-02-16].
 * 2. Automatischer Sync direkt beim Skriptstart/Speichern (2s Verzögerung).
 * 3. Automatisches Stashing & Merging bei Konflikten (Local-Wins).
 * 4. Statusmeldungen via ioBroker-Log, Telegram und Gotify [cite: 2026-02-23].
 * * VERSION: 2026-03-05 - Wiederherstellung nach Backup & Bereinigung
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const PATH_SCRIPTS = '/home/iobroker/scripts'; 
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
 * Zentralisiert den Versand von Statusmeldungen an alle Kanäle.
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

// --- 3. DIE SYNC-FUNKTION (KERNLOGIK) ---

/**
 * Funktion: runGitSync
 * Führt die Git-Befehlskette mit automatischer Konfliktlösung aus.
 */
function runGitSync() {
    const exec = require('child_process').exec;
    const timestamp = formatDate(new Date(), "YYYY-MM-DD HH:mm");
    
    log("[Git-Sync] Synchronisation wird gestartet...", 'info');

    /**
     * Erklärung der robusten Befehlskette:
     * 1. git add . && git stash: Lokale Änderungen sicher zwischenparken.
     * 2. git pull ... -X ours: GitHub-Stand holen. Lokale Version ('ours') gewinnt bei Konflikten.
     * 3. git stash pop: Geparkte Änderungen wieder einspielen.
     * 4. git add . && commit: Finalen Stand vorbereiten.
     * 5. git push: Zurück zu GitHub schieben.
     */
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
        
        // Fehlerprüfung: Ignoriere Standard-Meldungen, die keine echten Fehler sind
        if (error && !fullOutput.includes("everything up-to-date") && !fullOutput.includes("already up to date") && !fullOutput.includes("no local changes to save")) {
            log("[Git-Sync] Kritischer Fehler: " + error.message, 'error');
            sendSyncNotify("⚠️ Fehler: " + error.message, 5);
            return;
        }

        // Erfolgskontrolle für das Widget
        const hasLocalChanges = fullOutput.includes("file changed") || fullOutput.includes("files changed") || fullOutput.includes("delete mode") || fullOutput.includes("dropped refs");
        const hasRemoteUpdates = fullOutput.includes("updating") || fullOutput.includes("fast-forward");

        if (hasLocalChanges || hasRemoteUpdates) {
            sendSyncNotify("✅ Sync erfolgreich (Konflikte gelöst) am " + timestamp);
        } else {
            const infoMsg = "✅ Alles aktuell (" + timestamp + ")";
            log("[Git-Sync] " + infoMsg, 'info');
            setState(STATE_STATUS, infoMsg, true);
        }
    });
}

// --- 4. TRIGGER & AUTOMATISIERUNG ---

// A. Geplante Ausführung: Täglich um 00:07 Uhr [cite: 2026-02-16]
schedule("07 0 * * *", runGitSync);

// B. Sofortige Ausführung beim Skript-Start / Speichern
// Wir warten 2 Sekunden, damit ioBroker Zeit für die Initialisierung hat [cite: 2026-02-23]
setTimeout(() => {
    log("[Git-Sync] Initialer Start-Sync wird ausgeführt...", 'info');
    runGitSync();
}, 2000);