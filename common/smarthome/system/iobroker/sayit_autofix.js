/**
 * =============================================================================
 * NAME: SayIt_AutoFix_Ultimate.js
 * ZWECK: Stellt den flüchtigen Symlink für den SayIt-Cache sicher.
 * * FUNKTIONSWEISE:
 * 1. Proaktiv: Prüft alle 10 Minuten den Zustand des Symlinks.
 * 2. Reaktiv: Reagiert sofort auf 'ENOENT'-Fehlermeldungen im ioBroker-Log.
 * 3. Datenbank-Sync: Hält die ioBroker-Objekte auf dem korrekten Cache-Pfad.
 * =============================================================================
 */

const { exec } = require("child_process");

// --- KONFIGURATION ---
// Der Ort, an dem die MP3-Dateien permanent liegen (sicher vor Updates)
const SAFE_CACHE_DIR = "/opt/iobroker/iobroker-data/sayit_cache";
// Die "Soll-Stelle", an der der Adapter den Ordner 'cache' erwartet
const LINK_PATH = "/opt/iobroker/node_modules/cache";
// Der Pfad, der in die ioBroker-Objekte geschrieben wird (relativ zum Adapter-Verzeichnis)
const REL_CACHE_PATH = "../../cache/";

/**
 * Kernfunktion: Prüft das System und führt bei Bedarf Reparaturen aus.
 * @param {string} reason - Grund des Aufrufs (für das Log)
 */
async function repairSayItSystem(reason = "Routine") {
  //log(`--- SayIt-Check (${reason}): Starte Überprüfung ---`, 'info');

  try {
    // SCHRITT 1: Physischen Ordner sicherstellen
    // 'mkdir -p' erstellt den Ordner nur, wenn er noch nicht existiert.
    await runShell(`mkdir -p ${SAFE_CACHE_DIR}`);

    // SCHRITT 2: Symlink-Zustand abfragen
    // 'readlink -f' gibt das reale Ziel eines Symlinks aus.
    let currentLink;
    try {
      currentLink = await runShell(`readlink -f ${LINK_PATH}`);
    } catch {
      // Falls der Link gar nicht existiert, liefert readlink einen Fehler
      currentLink = "NOT_FOUND";
    }

    // SCHRITT 3: Reparatur bei Abweichung
    // Falls der Link fehlt oder auf das falsche Ziel zeigt:
    if (currentLink !== SAFE_CACHE_DIR) {
      log(`Abweichung erkannt! Ziel: ${SAFE_CACHE_DIR}, Ist-Zustand: ${currentLink}`, "warn");

      // Alten (toten) Link oder falschen Ordner löschen
      await runShell(`rm -rf ${LINK_PATH}`);
      // Neuen Symlink erstellen: verknüpfe SAFE_CACHE_DIR mit LINK_PATH
      await runShell(`ln -s ${SAFE_CACHE_DIR} ${LINK_PATH}`);

      log("Symlink und Berechtigungen wurden erfolgreich wiederhergestellt", "info");
    } else {
      //log('Infrastruktur ist intakt. Kein Eingreifen erforderlich.', 'info');
    }

    // SCHRITT 4: ioBroker-Objekte synchronisieren
    // Wir suchen alle Instanzen von SayIt (sayit.0, sayit.1, etc.)
    const instances = $(`system.adapter.sayit.*`);

    for (const id of instances) {
      // Nur die Haupt-Objekte bearbeiten (nicht .alive oder .connected)
      if (id.match(/^system\.adapter\.sayit\.\d+$/)) {
        const obj = await getObjectAsync(id);

        // Prüfen, ob Cache aktiviert ist UND der Pfad stimmt
        if (!obj.native.cache || obj.native.cacheDir !== REL_CACHE_PATH) {
          log(`Konfiguration für ${id} war unvollständig. Korrigiere`, "info");
          await extendObjectAsync(id, {
            native: {
              cache: true,
              cacheDir: REL_CACHE_PATH,
            },
          });
        }
      }
    }
  } catch (err) {
    log(`Fehler bei der Reparatur-Ausführung: ${err}`, "error");
  }
}

/**
 * Hilfsfunktion zum Ausführen von Shell-Befehlen via Sudo
 */
function runShell(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        // Detaillierte Fehlermeldung inkl. stderr für bessere Diagnose
        const errorMsg = stderr ? `${error.message} (Details: ${stderr.trim()})` : error.message;
        return reject(errorMsg);
      }
      // stdout trimmen, um Zeilenumbrüche zu entfernen
      resolve(stdout ? stdout.trim() : stderr ? stderr.trim() : "");
    });
  });
}

// --- TRIGGER 1: REAKTIVE LOG-ÜBERWACHUNG ---
// Sobald ein 'error' im Log auftaucht, der von 'sayit' kommt und 'ENOENT' enthält,
// schlägt das Skript sofort Alarm und repariert.
onLog("error", (data) => {
  if (data.from.startsWith("sayit") && data.message.includes("ENOENT")) {
    repairSayItSystem("Event-Trigger: ENOENT Fehler im Log erkannt");
  }
});

// --- TRIGGER 2: PROAKTIVER ZEITPLAN ---
// Alle 10 Minuten wird prophylaktisch geprüft. Das verhindert, dass das System
// lange im defekten Zustand verbleibt, falls der Log-Trigger mal nicht greift.
schedule("*/10 * * * *", () => {
  repairSayItSystem("Zeitplan-Trigger (10 Min)");
});

// --- TRIGGER 3: SKRIPTSTART ---
// Beim Speichern des Skripts oder Neustart des JS-Adapters einmal prüfen.
repairSayItSystem("Initialer Skriptstart");
