/**
 * =============================================================================
 * SCRIPT: SayIt_AutoFix_Persistent.js
 * BESCHREIBUNG: Repariert den flüchtigen Symlink für den SayIt-Cache und
 * konfiguriert alle Instanzen automatisch auf den sicheren Pfad.
 * AUTOMATISIERUNG: Läuft stündlich und bei jedem Skript-Start.
 * =============================================================================
 */

const { exec } = require('child_process');

// --- KONFIGURATION ---
const SAFE_CACHE_DIR = '/opt/iobroker/iobroker-data/sayit_cache';
const LINK_PATH = '/opt/iobroker/node_modules/cache';
const REL_CACHE_PATH = '../../cache/'; // Relativ gesehen vom Adapter-Folder

/**
 * Hilfsfunktion zur Ausführung von Shell-Befehlen (Promise-basiert)
 * @param {string} cmd - Der auszuführende Linux-Befehl
 */
function runShell(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                return reject(`Fehler bei [${cmd}]: ${error.message}`);
            }
            resolve(stdout ? stdout.trim() : stderr.trim());
        });
    });
}

/**
 * Kernfunktion der Reparatur
 * Prüft den Symlink auf Systemebene und die Config in der Datenbank.
 */
async function repairSayItSystem() {
    log('--- SayIt-Check: Starte Überprüfung der Cache-Struktur ---', 'info');

    try {
        // 1. SYSTEM-EBENE: Ordner und Symlink
        // Wir stellen sicher, dass der Zielordner existiert
        await runShell(`mkdir -p ${SAFE_CACHE_DIR}`);

        // Wir prüfen, ob der Symlink korrekt ist
        // -L prüft auf Symlink, readlink prüft das Ziel
        let currentLink;
        try {
            currentLink = await runShell(`readlink -f ${LINK_PATH}`);
        } catch (e) {
            currentLink = 'NOT_FOUND';
        }

        if (currentLink !== SAFE_CACHE_DIR) {
            log(`Symlink fehlerhaft oder fehlt (aktuell: ${currentLink}). Repariere...`, 'warn');

            // Alten Pfad/Link radikal entfernen und neu setzen
            await runShell(`rm -rf ${LINK_PATH}`);
            await runShell(`ln -s ${SAFE_CACHE_DIR} ${LINK_PATH}`);

            log('Symlink wurde erfolgreich wiederhergestellt.', 'info');
        } else {
            log('Symlink in node_modules ist korrekt vorhanden.', 'info');
        }

        // 2. IOBROKER-EBENE: Instanz-Konfiguration
        // Wir suchen alle SayIt-Instanz-Objekte
        const instances = await $(`system.adapter.sayit.*`);

        for (const id of instances) {
            // Wir filtern nur die Haupt-Instanzen (z.B. system.adapter.sayit.0)
            if (id.match(/^system\.adapter\.sayit\.\d+$/)) {
                const obj = await getObjectAsync(id);

                // Nur aktualisieren, wenn Cache aus ist oder der Pfad nicht stimmt
                if (!obj.native.cache || obj.native.cacheDir !== REL_CACHE_PATH) {
                    log(`Aktualisiere Konfiguration für ${id}...`, 'info');
                    await extendObjectAsync(id, {
                        native: {
                            cache: true,
                            cacheDir: REL_CACHE_PATH
                        }
                    });
                    // ioBroker startet die Instanz nach extendObject automatisch neu
                }
            }
        }

        log('--- SayIt-Check: Alles im grünen Bereich ---', 'info');

    } catch (err) {
        log(`Kritischer Fehler bei SayIt-Reparatur: ${err}`, 'error');
    }
}

// --- AUTOMATISIERUNG ---

// 1. Ausführung beim Start des Skripts (oder Neustart des JS-Adapters)
repairSayItSystem();

// 2. Regelmäßige Ausführung (Schedule)
// Wir prüfen jede Stunde zur Minute , ob der Link noch da ist.
schedule("27 * * * *", () => {
    repairSayItSystem();
});
