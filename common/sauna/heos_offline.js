// --- KONFIGURATION ---
const ID_PING = "ping.0.iobroker.192_168_178_222";
const ID_RESTART_BUTTON = "0_userdata.0.heos.Sauna.restart";
const ID_HEOS_POWER = "alias.0.sauna.amp_plug.state";
const ID_GOTIFY_TOKEN = "0_userdata.0.gotifytoken.iobroker";

const PING_TIMEOUT_SEC = 240; // 4 Minuten warten, bevor Auto-Restart
const RESTART_PAUSE_MS = 10000; // 10 Sekunden Strom aus
// ----------------------

let isManuell = false;
let autoRestartTimer = null;

/**
 * Zentrale Funktion für Benachrichtigungen (Telegram & Gotify)
 */
function notify(message) {
  // Telegram
  sendTo("telegram", "send", { text: message });
  console.warn(`[Sauna Heos] ${message}`);

  // Gotify via exec (curl)
  const token = getState(ID_GOTIFY_TOKEN).val;
  const command = `curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker: \n" -F "message=${message}" -F "priority=1"`;
  exec(command);
}

/**
 * Führt den eigentlichen Hardware-Neustart durch (Strom aus -> warten -> Strom an)
 */
function performHeosRestart(isManualAction) {
  const msg = isManualAction
    ? "📻 Der Heos-Amp in der Sauna wurde manuell gestartet."
    : "📻 Der Heos-Amp in der Sauna wurde automatisch neu gestartet.";

  // Strom aus
  setState(ID_HEOS_POWER, false);

  // Nach Pause Strom wieder an
  setTimeout(() => {
    setState(ID_HEOS_POWER, true);
    notify(msg);

    if (isManualAction) {
      isManuell = false; // Flag zurücksetzen
      setState(ID_RESTART_BUTTON, false, true); // Button-State zurücksetzen
    }
  }, RESTART_PAUSE_MS);
}

// TRIGGER 1: Überwachung via Ping
on({ id: ID_PING, change: "ne" }, (obj) => {
  // Wenn Ping verloren geht (val = false)
  if (!obj.state.val) {
    if (!autoRestartTimer && !isManuell) {
      //console.log(`[Sauna Heos] Ping verloren. Auto-Restart in ${PING_TIMEOUT_SEC}s geplant.`);
      autoRestartTimer = setTimeout(() => {
        // Nochmal prüfen, ob Ping immer noch weg ist
        if (!getState(ID_PING).val && !isManuell) {
          performHeosRestart(false);
        }
        autoRestartTimer = null;
      }, PING_TIMEOUT_SEC * 1000);
    }
  } else {
    // Ping ist wieder da: Timer abbrechen
    if (autoRestartTimer) {
      //console.log('[Sauna Heos] Ping wieder da. Auto-Restart abgebrochen.');
      clearTimeout(autoRestartTimer);
      autoRestartTimer = null;
    }
  }
});

// TRIGGER 2: Manueller Restart-Button
on({ id: ID_RESTART_BUTTON, val: true, change: "any" }, () => {
  console.log("[Sauna Heos] Manueller Restart ausgelöst.");
  isManuell = true;

  // Bestehenden Auto-Timer sofort löschen, falls vorhanden
  if (autoRestartTimer) {
    clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
  }

  performHeosRestart(true);
});
