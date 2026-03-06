/**
 * =============================================================================
 * ioBroker GIT FULL-SYNC (ULTRA-STABIL & DEBUG-MODUS)
 * =============================================================================
 */

const PATH_SCRIPTS = '/home/iobroker/scripts'; 
const STATE_STATUS = '0_userdata.0.git_sync_last_status';
const STATE_TRIGGER = '0_userdata.0.git_sync_trigger';
const SELF_NAME = 'common.smarthome.system.github.script_verwaltung';

function restartAffectedScripts() {
    const exec = require('child_process').exec;
    const checkCmd = "cd " + PATH_SCRIPTS + " && git diff --name-only HEAD@{1} HEAD";

    exec(checkCmd, { timeout: 30000 }, (error, stdout) => {
        if (error) return;
        const changedFiles = stdout.split('\n');
        changedFiles.forEach(file => {
            if (file.endsWith('.js')) {
                let scriptId = file.replace('.js', '').replace(/\//g, '.');
                if (scriptId === SELF_NAME) return; 

                let fullPath = 'javascript.0.scriptEnabled.' + scriptId;
                if (existsState(fullPath)) {
                    log("[Git-Sync] Neustart: " + scriptId);
                    setState(fullPath, false);
                    setTimeout(() => setState(fullPath, true), 1500);
                }
            }
        });
    });
}

function runGitSync() {
    const exec = require('child_process').exec;
    const jetzt = new Date();
    // hh = 24h Format in ioBroker
    const timestamp = formatDate(jetzt, "YYYY-MM-DD hh:mm");
    
    log("[Git-Sync] Synchronisation gestartet...", 'info');

    // SCHRITT 1: NUR PULL (Holt neue Daten vom Server)
    const pullCmd = "cd " + PATH_SCRIPTS + " && git pull origin main -s recursive -X ours";
    
    // timeout: 60000 verhindert, dass das Skript länger als 1 Minute hängt
    exec(pullCmd, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
            log("[Git-Sync] FEHLER beim Pull: " + error.message, 'error');
            log("[Git-Sync] Details: " + stderr, 'error');
            setState(STATE_STATUS, "❌ Fehler beim Pull (" + timestamp + ")", true);
            return;
        }

        const fullOutput = (stdout + stderr).toLowerCase();
        const hasChanges = fullOutput.includes("changed") || fullOutput.includes("updating") || fullOutput.includes("fast-forward");

        if (hasChanges) {
            log("[Git-Sync] Neue Versionen gefunden. Verarbeite Updates...", 'info');
            setTimeout(restartAffectedScripts, 2000); 
            setState(STATE_STATUS, "✅ Update erfolgt (" + timestamp + ")", true);
        } else {
            log("[Git-Sync] Keine Änderungen auf dem Server gefunden.");
            setState(STATE_STATUS, "✅ Alles aktuell (" + timestamp + ")", true);
        }

        // SCHRITT 2: PUSH im Hintergrund (Deine Änderungen hochladen)
        // Wir führen das getrennt aus, damit der Pull-Status sofort angezeigt wird
        const pushCmd = "cd " + PATH_SCRIPTS + " && git add . && (git commit -m 'Auto-Sync: " + timestamp + "' || true) && git push origin main";
        
        exec(pushCmd, { timeout: 60000 }, (pError, pStdout, pStderr) => {
            if (pError) {
                log("[Git-Sync] Push-Fehler (Hintergrund): " + pStderr, 'warn');
            } else {
                log("[Git-Sync] Hintergrund-Push erfolgreich.");
            }
        });
    });
}

// --- TRIGGER ---
schedule("07 0 * * *", runGitSync);

on({id: STATE_TRIGGER, change: "any", val: true}, () => {
    runGitSync();
    setTimeout(() => setState(STATE_TRIGGER, false, true), 1000);
});

on({id: "javascript.0.scriptEnabled." + name, change: "ne"}, () => {});