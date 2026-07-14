/* eslint-env es2022 */
// =============================================================================
// ZIGBEE-HOST VERSION-CHECKER v3.0 (AUTO-DP & ASYNC)
// =============================================================================

// Konfigurationseinstellungen für die SSH-Verbindung und den Speicherpfad der Datenpunkte.
const ID_REMOTE_IP = "192.168.178.80"; // Die IP-Adresse des entfernten Raspberry Pi (Zigbee-Host)
const BASE_PATH = "0_userdata.0.ioBroker.RPI_Zigbee."; // Der Stammordner, unter dem die Datenpunkte in ioBroker angelegt werden

// Definition aller Datenpunkte, die automatisch erstellt und aktualisiert werden sollen.
// Jedes Objekt beschreibt ID, Standardwert (val), Anzeigename (name), Datentyp (type) und ioBroker-Rolle (role).
const STATES_TO_CREATE = [
  {
    id: "js_contr_ver",
    val: "",
    name: "JS-Controller Version",
    type: "string",
    role: "info.version",
  },
  { id: "node_ver", val: "", name: "Node.js Version", type: "string", role: "info.version" },
  { id: "nodejs_ver", val: "", name: "NodeJS Version", type: "string", role: "info.version" },
  { id: "npm_ver", val: "", name: "NPM Version", type: "string", role: "info.version" },
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
 * Hauptfunktion zum Abrufen der Versionen vom entfernten Host per SSH.
 * Führt nacheinander folgende Schritte durch:
 * 1. Stellt sicher, dass alle Datenpunkte existieren (initDP)
 * 2. Baut den SSH-Befehl zusammen und führt ihn aus
 * 3. Splittet die Rückgabe zeilenweise auf und schreibt die Werte in die Datenpunkte
 * 4. Aktualisiert Online-Status und Zeitstempel
 */
async function updateZigbeeVersions() {
  // Zuerst sicherstellen, dass die Datenpunkt-Struktur vorhanden ist
  await initDP();

  // SSH-Parameter:
  // -o StrictHostKeyChecking=no: Akzeptiert den SSH-Key des Remote-Hosts automatisch (verhindert interaktiven Prompt)
  // -o UserKnownHostsFile=/dev/null: Speichert den Key nicht dauerhaft in der known_hosts Datei (hält das System sauber)
  const sshFlags = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null";

  // Der Befehl, der auf dem entfernten Raspberry Pi ausgeführt werden soll.
  // Führt nacheinander ioBroker-, Node- und NPM-Versionstests aus, getrennt durch ein Semikolon.
  const remoteCmd = '"iobroker -v; node -v; nodejs -v; npm -v"';

  // Zusammengebauter SSH-Aufruf für den Benutzer "thomas"
  const command = `ssh ${sshFlags} thomas@${ID_REMOTE_IP} ${remoteCmd}`;

  try {
    // Führt den SSH-Befehl asynchron aus
    const stdout = await runShell(command);

    // Splittet den Output anhand von Zeilenumbrüchen auf
    const lines = stdout.split("\n");

    // Wir erwarten mindestens 4 Zeilen Output (je eine Version für iobroker, node, nodejs, npm)
    if (lines.length >= 4) {
      // Werte bereinigen und in die jeweiligen Datenpunkte schreiben (ack=true für Bestätigung)
      setState(`${BASE_PATH}js_contr_ver`, lines[0].trim(), true);
      setState(`${BASE_PATH}node_ver`, lines[1].trim(), true);
      setState(`${BASE_PATH}nodejs_ver`, lines[2].trim(), true);
      setState(`${BASE_PATH}npm_ver`, lines[3].trim(), true);

      // Aktuelles Datum und Uhrzeit im deutschen Format generieren und wegschreiben
      const now = new Date().toLocaleString("de-DE");
      setState(`${BASE_PATH}last_update`, now, true);

      // Da die Abfrage erfolgreich war, setzen wir den Online-Status auf true
      setState(`${BASE_PATH}online`, true, true);
    } else {
      // Warnung protokollieren, falls die Ausgabe unvollständig war
      console.warn(`[Version-Check] Unerwarteter Output (zu kurz). Zeilen: ${lines.length}.`);
      setState(`${BASE_PATH}online`, false, true);
    }
  } catch (error) {
    // Fehlerbehandlung: Loggt den genauen SSH-Fehler und setzt den Online-Status auf false
    console.error(`[Version-Check] SSH-Fehler bei ${ID_REMOTE_IP}: ${error.message}`);
    setState(`${BASE_PATH}online`, false, true);
  }
}

// Zeitplan (Cron-Job): Führt das Skript stündlich zur Minute 5 aus (z.B. um 12:05 Uhr, 13:05 Uhr, etc.)
schedule("5 * * * *", updateZigbeeVersions);

// Sofortiger Aufruf beim Skriptstart / Speichern des Skripts, damit die Daten sofort geladen werden
updateZigbeeVersions();
