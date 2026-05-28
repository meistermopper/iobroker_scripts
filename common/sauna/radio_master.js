// =============================================================================
// RADIO SAUNA MASTER-STEUERUNG v3.0 (Manual & Auto Combined)
// =============================================================================

// --- KONFIGURATION ---
const ID_SAUNA_AKTIV = "0_userdata.0.Haushalt.sauna_laeuft";   // Master-Schalter
const DEFAULT_VOLUME = 10;                                     // Standard-Lautstärke Sauna
const AUTO_SENDER    = "smoothjazz";                           // Sender für Automatik

const DELAY_BAD      = 5 * 60 * 1000;                          // 5 Min Verzögerung Bad
const DELAY_SAUNA    = 20 * 60 * 1000;                         // 20 Min Verzögerung Sauna

const IDS = {
    saunaPlayer: "alias.0.sauna.media.heos",
    saunaSender: "0_userdata.0.heos.Sauna.sender",
    saunaStatus: "0_userdata.0.heos.Sauna.radio_status",
    badSender:   "0_userdata.0.heos.Bad.sender",
    badStatus:   "0_userdata.0.heos.Bad.radio_status"
};

// Gotify Token für Fehlermeldungen/Status
const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker").val;

// Mapping: Key aus dem Datenpunkt -> HEOS Preset Nummer & Anzeigename
const saunaMap = {
  jazzgroove: { preset: 1, name: "The Jazz Groove" },
  jazzradio: { preset: 2, name: "Jazz Radio" },
  smoothjazz: { preset: 3, name: "Smoothjazz" },
  hr1: { preset: 4, name: "HR 1" },
  hrinfo: { preset: 5, name: "hr info" },
  swissjazz: { preset: 6, name: "Swiss Jazz" },
  mdrkultur: { preset: 7, name: "MDR Kultur" },
  hr3: { preset: 8, name: "HR 3" },
  ffh: { preset: 9, name: "FFH" },
  jazzloft: { preset: 10, name: "Jazz Loft" }
};

// Timer für die Automatik
let tAutoBad = null;
let tAutoSauna = null;

/**
 * Zentrale Benachrichtigungsfunktion
 * Sendet Statusmeldungen an Telegram und Gotify
 */
function notify(msg) {
  sendTo("telegram", "send", { text: msg });
  console.log("Notification: " + msg);

  // Gotify-Versand via Shell-Befehl (curl)
  exec(
    `curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker" -F "message=${msg}" -F "priority=1"`,
  );
}

/**
 * Stoppt laufende Einschalt-Timer
 */
function clearAutoTimers() {
    if (tAutoBad) { clearTimeout(tAutoBad); tAutoBad = null; }
    if (tAutoSauna) { clearTimeout(tAutoSauna); tAutoSauna = null; }
}

// --- LOGIK ---

/**
 * 1. AUTOMATIK-TRIGGER (Sauna Master-Schalter)
 */
on({ id: ID_SAUNA_AKTIV, change: "ne" }, (obj) => {
    const isStarting = !!obj.state.val;

    if (isStarting) {
        notify("🧖 Sauna-Modus aktiv: Musik-Automatik gestartet.");
        clearAutoTimers();

        // Bad verzögert einschalten
        tAutoBad = setTimeout(() => {
            setState(IDS.badSender, AUTO_SENDER);
            tAutoBad = null;
        }, DELAY_BAD);

        // Sauna verzögert einschalten
        tAutoSauna = setTimeout(() => {
            setState(IDS.saunaSender, AUTO_SENDER);
            tAutoSauna = null;
        }, DELAY_SAUNA);

    } else {
        notify("⏹️ Sauna-Modus beendet: Musik wird gestoppt.");
        clearAutoTimers();

        // Alles aus
        setState(IDS.saunaStatus, false);
        setState(IDS.badStatus, false);
        setState(IDS.saunaSender, "");
    }
});

/**
 * 2. MANUELLER STATUS-TRIGGER (Play/Stop)
 * Reagiert, wenn der Radio-Status manuell oder durch Skripte geändert wird.
 */
on({ id: IDS.saunaStatus, change: "ne" }, (obj) => {
  const isPlaying = !!obj.state.val;

  setState(`${IDS.saunaPlayer}.state`, isPlaying ? "play" : "stop");

  if (!isPlaying) {
    notify("+++ 📻 ⏹️ Radio in der Sauna wurde ausgeschaltet +++");
  }
});

/**
 * 3. SENDER-TRIGGER
 * Wird ausgelöst, wenn im Datenpunkt ein neuer Sendername gesetzt wird.
 */
on({ id: IDS.saunaSender, change: "any" }, (obj) => {
  if (!obj.state.val) return; // Leere Sender (Reset) ignorieren

  const senderKey = obj.state.val;
  const sender = saunaMap[senderKey];

  if (sender) {
    // HEOS Command Syntax: Lautstärke setzen UND Preset abspielen in einem String
    // Das Trennzeichen | erlaubt das Verketten von Befehlen.
    const cmd = `set_volume&level=${DEFAULT_VOLUME}|play_preset&preset=${sender.preset}`;

    // Befehl an den HEOS Adapter senden
    setState(`${IDS.saunaPlayer}.command`, cmd);

    // Den Status-Datenpunkt zeitverzögert auf 'true' setzen (Synchronisation)
    setStateDelayed(IDS.saunaStatus, true, 1000, false);

    notify(`+++ 📻 ▶️ Radio in der Sauna läuft (${sender.name}) +++`);
  } else {
    console.warn(`Sauna: Sender '${senderKey}' ist nicht in der saunaMap konfiguriert.`);
  }
});
