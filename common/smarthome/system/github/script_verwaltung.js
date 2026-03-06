/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC (LOGIK-ERKLÄRUNG & STABILITÄT)
 * =============================================================================
 */

// --- 1. SETUP & VARIABLEN ---
const PATH_SCRIPTS = '/home/iobroker/scripts'; 
const STATE_STATUS = '0_userdata.0.git_sync_last_status';
const STATE_TRIGGER = '0_userdata.0.git_sync_trigger';

/**
 * EIGENSICHERUNG:
 * Wir speichern den Namen dieses Skripts. Wenn Git meldet, dass sich DIESE Datei 
 * geändert hat, darf das Skript sich nicht selbst neu starten. 
 * Sonst: Sync -> Neustart -> Sync -> Neustart (Endlosschleife).
 */
const SELF_NAME = 'common.smarthome.system.github.script_verwaltung';

// --- 2. LOGIK: DIE NEUSTART-ROUTINE ---

/**
 * Warum brauchen wir das?
 * ioBroker liest Dateien von der Festplatte nur beim Starten ein. Wenn Git eine Datei
 * ändert, merkt der Adapter das zwar, stoppt das Skript aber oft nur.
 * Diese Funktion "stupst" die betroffenen Skripte gezielt an.
 */
function restartAffectedScripts() {
    const exec = require('child_process').exec;
    
    // Wir fragen Git: "Was hat sich beim letzten Pull (HEAD@{1}) zum jetzigen Stand geändert?"
    const checkCmd = "cd " + PATH_SCRIPTS + " && git diff --name-only HEAD@{1} HEAD";

    exec(checkCmd, (error, stdout) => {
        if (error) return;

        // Wir machen aus der Text-Antwort eine Liste von Dateien
        const changedFiles = stdout.split('\n');
        
        changedFiles.forEach(file => {
            if (file.endsWith('.js')) {
                // Konvertierung: 'pfad/datei.js' -> 'pfad.datei' (ioBroker Format)
                let scriptId = file.replace('.js', '').replace(/\//g, '.');
                
                // Prüfen: Bin ich das selbst? Wenn ja, ignorieren.
                if (scriptId === SELF_NAME) return; 

                let fullPath = 'javascript.0.scriptEnabled.' + scriptId;
                
                if (existsState(fullPath)) {
                    log("[Git-Sync] Automatischer Neustart: " + scriptId);
                    
                    // Der "Herzschrittmacher-Trick":
                    // Wir setzen den Status auf false (aus) und nach 2 Sekunden auf true (an).
                    // Die Pause ist wichtig, damit der ioBroker-Adapter Zeit hat, die
                    // neue Datei von der Festplatte komplett zu indizieren.
                    setState(fullPath, false);
                    setTimeout(() => setState(fullPath, true), 2000);
                }
            }
        });
    });
}

// --- 3. LOGIK: DER SYNCHRONISATIONS-PROZESS ---

function runGitSync() {
    // require('child_process') erlaubt es uns, Befehle wie in einer Linux-Konsole zu tippen.
    const exec = require('child_process').exec;
    const jetzt = new Date();
    
    // 'hh' (klein) ist zwingend für ioBroker, um die Stunden-Zahlen auszugeben.
    const timestamp = formatDate(jetzt, "YYYY-MM-DD hh:mm");
    
    log("[Git-Sync] Synchronisation wird gestartet...", 'info');

    /**
     * DIE BEFEHLSKETTE (Logik):
     * 1. git add . -> "Merke dir alle meine lokalen Änderungen."
     * 2. git commit -> "Packe die Änderungen in ein Paket mit Zeitstempel."
     * (|| true verhindert einen Abbruch, falls es gar nichts zum Packen gab)
     * 3. git pull -> "Hole neue Änderungen von GitHub und mische sie ein."
     * (-X ours sagt: Im Zweifelsfall behalte meine lokalen Einstellungen bei Konflikten)
     * 4. git push -> "Schicke das Gesamtergebnis hoch zu GitHub."
     */
    const cmd = "cd " + PATH_SCRIPTS + " && " +
                "git add . && " +
                "(git commit -m 'Auto-Sync: " + timestamp + "' || true) && " +
                "git pull origin main -s recursive -X ours && " +
                "git push origin main";
    
    exec(cmd, (error, stdout, stderr) => {
        const fullOutput = (stdout + stderr).toLowerCase();
        
        // Gab es echte Änderungen am Code? (Schlüsselwörter in der Git-Antwort)
        const hasChanges = fullOutput.includes("changed") || 
                           fullOutput.includes("updating") || 
                           fullOutput.includes("fast-forward");

        if (hasChanges) {
            log("[Git-Sync] Neue Versionen gefunden. Starte Updates...");
            // Wir warten 5 Sekunden, bevor wir die Skripte neu starten.
            // Das gibt dem Mirroring-Prozess des Adapters genug Puffer.
            setTimeout(restartAffectedScripts, 5000); 
            setState(STATE_STATUS, "✅ Sync erfolgreich (" + timestamp + ")", true);
        } else {
            // Nichts zu tun -> Status-Update für dein Widget
            setState(STATE_STATUS, "✅ Alles aktuell (" + timestamp + ")", true);
        }
    });
}

// --- 4. AUTOMATISIERUNG & TRIGGER ---

// Einmal am Tag nachts um 00:07 Uhr alles glattziehen.
schedule("07 0 * * *", runGitSync);

// Button-Logik: Wenn du in VS Code den Trigger-Datenpunkt auf true setzt.
on({id: STATE_TRIGGER, change: "any", val: true}, () => {
    runGitSync();
    // Button nach 1 Sekunde automatisch wieder lösen (für den nächsten Klick)
    setTimeout(() => setState(STATE_TRIGGER, false, true), 1000);
});

// Fix: Hält das Skript im "Laufen"-Zustand für ioBroker.
on({id: "javascript.0.scriptEnabled." + name, change: "ne"}, () => {});