// =============================================================================
// IOBROKER-MASTER VERSION-CHECKER v3.1 (LOCAL EXECUTION)
// =============================================================================

// Konfigurationseinstellungen für den Speicherpfad der Datenpunkte.
const BASE_PATH = "0_userdata.0.ioBroker.versionen."; // Der Stammordner für diese Versionen in ioBroker

// Definition aller Datenpunkte, die automatisch erstellt und aktualisiert werden sollen.
// Entspricht den IDs aus dem ioBroker-Objektbaum. Fehlende Datenpunkte werden automatisch angelegt.
const STATES_TO_CREATE = [
  {
    id: "JS_Controller",
    val: "",
    name: "JS-Controller Version",
    type: "string",
    role: "info.version",
  },
  { id: "node", val: "", name: "Node.js Version", type: "string", role: "info.version" },
  { id: "nodejs", val: "", name: "NodeJS Version", type: "string", role: "info.version" },
  { id: "NPM", val: "", name: "NPM Version", type: "string", role: "info.version" },
  { id: "last_update", val: "", name: "Letztes Update", type: "string", role: "date" },
  { id: "online", val: false, name: "Online Status", type: "boolean", role: "indicator.connected" },
];

/**
 * Initialisiert die Datenpunkte.
 * Geht das STATES_TO_CREATE-Array durch und prüft für jeden Datenpunkt mit `existsState()`, ob er bereits existiert.
 * Falls nicht, wird er asynchron mit `createStateAsync()` erzeugt.
 */
async function initDP() {
  for (const s of STATES_TO_CREATE) {
    const fullPath = BASE_PATH + s.id;
    // existsState ist eine synchrone ioBroker-Funktion zur Existenzprüfung
    if (!existsState(fullPath)) {
      // createStateAsync erstellt den Datenpunkt asynchron in der ioBroker-Objektdatenbank
      await createStateAsync(fullPath, s.val, {
        name: s.name,
        type: s.type,
        role: s.role,
        read: true,
        write: false,
      });
    }
  }
}

/**
 * Hilfsfunktion zur Ausführung von Shell-Befehlen (exec) verpackt in ein Promise.
 * Dies erlaubt die Verwendung von modernem async/await anstelle von verschachtelten Callbacks.
 *
 * @param {string} cmd - Der auszuführende Shell-Befehl
 * @returns {Promise<string>} Das bereinigte Ergebnis (stdout) der Befehlsausführung
 */
function runShell(cmd) {
  return new Promise((resolve, reject) => {
    // exec ist die ioBroker-eigene Funktion zum Ausführen von Terminalbefehlen
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        // Falls ein Fehler auftritt, detaillierte Fehlermeldung mitsamt stderr zusammenbauen
        const errorMsg = stderr ? `${error.message} (Details: ${stderr.trim()})` : error.message;
        return reject(new Error(errorMsg));
      }
      // stdout trimmen (Leerzeichen/Zeilenumbrüche entfernen) und zurückgeben
      resolve(stdout ? stdout.trim() : "");
    });
  });
}

/**
 * Hauptfunktion zum Abrufen der Versionen auf dem lokalen Master-Host.
 * Da das Skript direkt auf dem Master-Server ausgeführt wird, ist kein SSH nötig.
 * Führt nacheinander folgende Schritte durch:
 * 1. Stellt sicher, dass alle Datenpunkte existieren (initDP)
 * 2. Führt die Versions-Abfragen lokal aus
 * 3. Splittet die Rückgabe zeilenweise auf und schreibt die Werte in die Datenpunkte
 * 4. Aktualisiert Online-Status und Zeitstempel
 */
async function updateMasterVersions() {
  // Zuerst sicherstellen, dass die Datenpunkt-Struktur vorhanden ist
  await initDP();

  // Da das Skript auf dem Master-Server läuft, können wir die Befehle direkt lokal ausführen.
  // Führt nacheinander ioBroker-, Node- und NPM-Versionstests aus, getrennt durch ein Semikolon.
  const command = "iobroker -v; node -v; nodejs -v; npm -v";

  try {
    // Führt den Befehl asynchron aus
    const stdout = await runShell(command);

    // Splittet den Output anhand von Zeilenumbrüchen auf
    const lines = stdout.split("\n");

    // Wir erwarten mindestens 4 Zeilen Output (je eine Version für iobroker, node, nodejs, npm)
    if (lines.length >= 4) {
      // Werte bereinigen und in die jeweiligen Datenpunkte schreiben (ack=true für Bestätigung)
      setState(BASE_PATH + "JS_Controller", lines[0].trim(), true);
      setState(BASE_PATH + "node", lines[1].trim(), true);
      setState(BASE_PATH + "nodejs", lines[2].trim(), true);
      setState(BASE_PATH + "NPM", lines[3].trim(), true);

      // Aktuelles Datum und Uhrzeit im deutschen Format generieren und wegschreiben
      const now = new Date().toLocaleString("de-DE");
      setState(BASE_PATH + "last_update", now, true);

      // Da die Abfrage erfolgreich war, setzen wir den Online-Status auf true
      setState(BASE_PATH + "online", true, true);
    } else {
      // Warnung protokollieren, falls die Ausgabe unvollständig war
      console.warn(
        `[Version-Check-Master] Unerwarteter Output (zu kurz). Zeilen: ${lines.length}.`,
      );
      setState(BASE_PATH + "online", false, true);
    }
  } catch (error) {
    // Fehlerbehandlung: Loggt den Fehler und setzt den Online-Status auf false
    console.error(`[Version-Check-Master] Fehler bei lokaler Ausführung: ${error.message}`);
    setState(BASE_PATH + "online", false, true);
  }
}

// Zeitplan (Cron-Job): Führt das Skript stündlich zur Minute 5 aus (z.B. um 12:05 Uhr, 13:05 Uhr, etc.)
schedule("5 * * * *", updateMasterVersions);

// Sofortiger Aufruf beim Skriptstart / Speichern des Skripts, damit die Daten sofort geladen werden
updateMasterVersions();
