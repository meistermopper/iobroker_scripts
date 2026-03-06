/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC (HIGH-SPEED & EIGENSICHER)
 * =============================================================================
 * Dieses Skript automatisiert den Abgleich zwischen ioBroker und GitHub.
 * Es ist darauf optimiert, Änderungen sofort aktiv zu schalten, ohne den 
 * laufenden Betrieb durch lange Wartezeiten zu stören.
 * =============================================================================
 */

// --- 1. KONFIGURATION & PFADE ---

// Der physische Pfad auf deinem Server. Hier liegen die .js Dateien und der .git Ordner.
const PATH_SCRIPTS = '/home/iobroker/scripts'; 

// Datenpunkte für die Kommunikation mit der Außenwelt (Widget & VS Code)
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const STATE_STATUS = '0_userdata.0.git_sync_last_status';
const STATE_TRIGGER = '0_userdata.0.git_sync_trigger';

/**
 * EIGENSICHERUNG:
 * Wir speichern den internen Namen dieses Skripts. 
 * Wenn Git meldet, dass sich DIESE Datei hier geändert hat, darf das Skript 
 * keinen Neustart-Impuls an sich selbst senden. 
 * Ohne diese Zeile würde das Skript bei jedem Update eine Endlosschleife starten.
 */
const SELF_NAME = 'common.smarthome.system.github.script_verwaltung';

// --- 2. BENACHRICHTIGUNGS-LOGIK ---

/**
 * Zentralisiert alle Meldungen. So musst du bei Änderungen an Telegram oder 
 * Gotify nur an einer Stelle im Code etwas anpassen.
 */
function sendSyncNotify(msg, priority = 1) {
    // 1. Aktualisiert den Text in deinem ioBroker-Widget (VIS)
    setState(STATE_STATUS, msg, true);
    
    // 2. Schickt eine Push-Nachricht via Telegram
    sendTo('telegram', 'send', { text: "🔄 Git-Sync: " + msg });
    
    // 3. Schickt eine Nachricht an deinen Gotify-Server
    const tokenState = getState(GOTIFY_TOKEN_ID);
    if (tokenState && tokenState.val) {
        httpPost("https://" + GOTIFY_SERVER + "/message?token=" + tokenState.val, {
            title: "ioBroker Sync",
            message: msg,
            priority: priority
        });
    }
}

// --- 3. DIE NEUSTART-LOGIK (DER "HERZSCHRITTMACHER") ---

/**
 * Diese Funktion wird aufgerufen, sobald neue Dateien vom Server geladen wurden.
 */
function restartAffectedScripts() {
    // 'child_process' erlaubt uns, Linux-Befehle direkt auszuführen
    const exec = require('child_process').exec;
    
    /**
     * LOGIK: Wir fragen Git nach den Namen der geänderten Dateien.
     * HEAD@{1} ist der Stand VOR dem Pull, HEAD ist der Stand JETZT.
     * git diff --name-only listet uns einfach nur die Dateinamen auf.
     */
    const checkCmd = "cd " + PATH_SCRIPTS + " && git diff --name-only HEAD@{1} HEAD";

    exec(checkCmd, { timeout: 30000 }, (error, stdout) => {
        if (error) return;

        // Wir zerteilen die Antwort von Git in eine Liste von Dateinamen
        const changedFiles = stdout.split('\n');
        
        changedFiles.forEach(file => {
            // Wir interessieren uns nur für .js Dateien
            if (file.endsWith('.js')) {
                // Konvertierung: 'ordner/skript.js' -> 'ordner.skript'
                let scriptId = file.replace('.js', '').replace(/\//g, '.');
                
                // PRÜFUNG: Wenn die Datei dieses Skript selbst ist -> Überspringen!
                if (scriptId === SELF_NAME) return; 

                let fullPath = 'javascript.0.scriptEnabled.' + scriptId;
                
                // Wenn das Skript im ioBroker existiert, geben wir ihm einen Neustart-Impuls
                if (existsState(fullPath)) {
                    log("[Git-Sync] Neustart-Impuls für: " + scriptId);
                    
                    /**
                     * Warum erst 'false' und dann 'true'?
                     * Das erzwingt, dass der Javascript-Adapter den Code neu von der
                     * Festplatte liest. Ohne das 'false' würde er einfach weiterlaufen.
                     */
                    setState(fullPath, false);
                    setTimeout(() => setState(fullPath, true), 1000);
                }
            }
        });
    });
}

// --- 4. DER HAUPTPROZESS (TURBO-SYNC) ---

/**
 * Diese Funktion führt den eigentlichen Datenabgleich durch.
 */
function runGitSync() {
    const exec = require('child_process').exec;
    const jetzt = new Date();
    
    /**
     * ZEITFORMAT:
     * 'hh' (kleingeschrieben!) ist wichtig für ioBroker, um die Stunden als
     * Ziffern (00-23) auszugeben. Ein großes 'HH' würde oft nur Text liefern.
     */
    const timestamp = formatDate(jetzt, "YYYY-MM-DD hh:mm");
    
    log("[Git-Sync] Synchronisation gestartet...", 'info');

    /**
     * SCHRITT 1: DER PULL (Daten holen)
     * Das hat Priorität, damit dein System so schnell wie möglich auf dem neuesten Stand ist.
     * -s recursive -X ours: Bei Konflikten gewinnt immer dein ioBroker-Stand.
     */
    const pullCmd = "cd " + PATH_SCRIPTS + " && git pull origin main -s recursive -X ours";
    
    exec(pullCmd, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
            log("[Git-Sync] FEHLER beim Pull: " + stderr, 'error');
            sendSyncNotify("❌ Fehler beim Pull (" + timestamp + ")", 2);
            return;
        }

        const fullOutput = (stdout + stderr).toLowerCase();
        
        // Prüfen, ob Git tatsächlich Dateien heruntergeladen hat
        const hasChanges = fullOutput.includes("changed") || 
                           fullOutput.includes("updating") || 
                           fullOutput.includes("fast-forward");

        if (hasChanges) {
            log("[Git-Sync] Neue Versionen gefunden. Starte sofortige Updates...");
            
            /**
             * WARTEZEIT (1500ms): 
             * Wir geben dem ioBroker-Adapter kurz Zeit, die neuen Dateien auf der
             * Platte zu bemerken (Dateispiegelung), bevor wir den Neustart triggern.
             */
            setTimeout(restartAffectedScripts, 1500); 
            sendSyncNotify("✅ Update erfolgreich (" + timestamp + ")");
        } else {
            log("[Git-Sync] Alles aktuell.");
            // Wir schreiben nur den Status, ohne Telegram zu spammen
            setState(STATE_STATUS, "✅ Alles aktuell (" + timestamp + ")", true);
        }

        /**
         * SCHRITT 2: DER PUSH (Hintergrund)
         * Das Hochladen deiner Änderungen zu GitHub dauert oft am längsten.
         * Wir machen das in einem eigenen Prozess, damit Schritt 1 (Neustarts)
         * nicht darauf warten muss. Das macht das Skript "gefühlt" viel schneller.
         */
        const pushCmd = "cd " + PATH_SCRIPTS + " && git add . && (git commit -m 'Auto-Sync: " + timestamp + "' || true) && git push origin main";
        
        exec(pushCmd, { timeout: 60000 }, (pError, pStdout, pStderr) => {
            if (pError) {
                log("[Git-Sync] Push-Warnung (Hintergrund): " + pStderr, 'warn');
            } else {
                log("[Git-Sync] Hintergrund-Push abgeschlossen.");
            }
        });
    });
}

// --- 5. TRIGGER & ZEITPLÄNE ---

// Automatischer Lauf jede Nacht um 00:07 Uhr [cite: 2026-02-16]
schedule("07 0 * * *", runGitSync);

// Manueller Start (z.B. durch deinen VS Code Shortcut Strg+Alt+S)
on({id: STATE_TRIGGER, change: "any", val: true}, () => {
    log("[Git-Sync] Manueller Start angefordert...");
    runGitSync();
    
    // Den Button-Datenpunkt nach 1 Sekunde wieder auf 'false' setzen
    setTimeout(() => setState(STATE_TRIGGER, false, true), 1000);
});

// SYSTEM-FIX: Hält das Skript im Arbeitsspeicher des ioBrokers aktiv
on({id: "javascript.0.scriptEnabled." + name, change: "ne"}, () => {});