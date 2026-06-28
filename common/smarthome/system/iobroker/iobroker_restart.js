// =============================================================================
// IOBROKER-MASTER CONTROL-SERVICE (RESTART & STOP)
// =============================================================================

// Konfiguration der Datenpunkt-Pfade
const ID_RESTART_TRIGGER = "0_userdata.0.ioBroker.iobroker_restart";
const ID_STOP_TRIGGER = "0_userdata.0.ioBroker.iobroker_stop";

// Array mit den zu erstellenden Datenpunkten
const STATES_TO_CREATE = [
  { id: ID_RESTART_TRIGGER, name: "ioBroker Master Neustart", type: "boolean", role: "button", def: false },
  { id: ID_STOP_TRIGGER, name: "ioBroker Master Stoppen", type: "boolean", role: "button", def: false }
];

/**
 * Initialisiert die benötigten Datenpunkte, falls sie nicht vorhanden sind.
 */
async function initDP() {
  for (const s of STATES_TO_CREATE) {
    // existsState ist eine synchrone ioBroker-Funktion zur Existenzprüfung
    if (!existsState(s.id)) {
      // createStateAsync erstellt den Datenpunkt asynchron in der ioBroker-Objektdatenbank
      await createStateAsync(s.id, s.def, {
        name: s.name,
        type: s.type,
        role: s.role,
        read: true,
        write: true // Da VIS diese Buttons drücken soll, müssen sie beschreibbar sein
      });
    }
  }
}

/**
 * Führt einen lokalen Systembefehl aus.
 * 
 * @param {string} cmd - Der auszuführende Befehl
 */
function runCommand(cmd) {
  // exec ist die ioBroker-eigene Funktion zum Ausführen von Terminalbefehlen
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`[ioBroker-Control] Fehler beim Ausführen von "${cmd}": ${error.message}`);
      return;
    }
    if (stdout) console.log(`[ioBroker-Control] Output: ${stdout.trim()}`);
    if (stderr) console.warn(`[ioBroker-Control] Stderr: ${stderr.trim()}`);
  });
}

// Haupt-Initialisierung
async function main() {
  // Zuerst sicherstellen, dass die Datenpunkt-Struktur vorhanden ist
  await initDP();

  // Trigger für RESTART: Reagiert, wenn der Datenpunkt auf "true" gesetzt wird
  on({ id: ID_RESTART_TRIGGER, val: true, change: "ne" }, async () => {
    console.warn("[ioBroker-Control] Neustart-Trigger empfangen! Der ioBroker-Master wird neu gestartet...");
    
    // WICHTIG: Trigger sofort wieder auf false zurücksetzen, um eine Endlosschleife beim Systemstart zu verhindern!
    setState(ID_RESTART_TRIGGER, false, true);
    
    // 1 Sekunde Verzögerung, damit der State-Reset sicher in der DB gespeichert wird,
    // bevor der ioBroker-Daemon beendet und neu gestartet wird.
    setTimeout(() => {
      runCommand("iobroker restart");
    }, 1000);
  });

  // Trigger für STOP: Reagiert, wenn der Datenpunkt auf "true" gesetzt wird
  on({ id: ID_STOP_TRIGGER, val: true, change: "ne" }, async () => {
    console.warn("[ioBroker-Control] Stopp-Trigger empfangen! Der ioBroker-Master wird heruntergefahren...");
    
    // WICHTIG: Trigger sofort wieder auf false zurücksetzen, damit er beim nächsten Systemstart zurückgesetzt ist.
    setState(ID_STOP_TRIGGER, false, true);
    
    // 1 Sekunde Verzögerung für sauberen DB-State-Reset
    setTimeout(() => {
      runCommand("iobroker stop");
    }, 1000);
  });
}

// Start der Initialisierung
main();
