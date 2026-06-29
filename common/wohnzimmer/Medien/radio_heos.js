// =============================================================================
// RADIO-STEUERUNG v2.0 (HEOS & DENON)
// =============================================================================

// --- KONFIGURATION ---
const ID_SENDER_TRIGGER = "0_userdata.0.heos.Wohnzimmer.sender";
const ID_DENON_POWER = "denon.0.zoneMain.powerZone";
const ID_HEOS_COMMAND = "heos.0.players.217493250.command";
const ID_RADIO_STATUS = "0_userdata.0.heos.Wohnzimmer.radio_status";

// Zentrale Sender-Liste (Hier kannst du einfach neue Sender hinzufügen)
const RADIO_CONFIG = {
  hr1: { preset: 4, vol: 25, name: "HR 1" },
  jazzgroove: { preset: 1, vol: 25, volCold: 15, name: "The Jazz Groove" },
  jazzradio: { preset: 2, vol: 25, name: "Jazz Radio" },
  smoothjazz: { preset: 3, vol: 25, name: "Smoothjazz" },
  hrinfo: { preset: 5, vol: 25, name: "hr info" },
  swissjazz: { preset: 6, vol: 25, name: "Swiss Jazz" },
  mdrkultur: { preset: 7, vol: 25, name: "MDR Kultur" },
  ffh: { preset: 9, vol: 25, name: "FFH" },
};

// --- LOGIK ---

on({ id: ID_SENDER_TRIGGER, change: "any" }, async (obj) => {
  const senderKey = obj.state.val;
  const config = RADIO_CONFIG[senderKey];

  if (!config) return; // Falls der Sender nicht in der Liste ist, nichts tun

  const denonAn = getState(ID_DENON_POWER)?.val;
  let volume = config.vol;
  let delay = 0;

  // --- FALLUNTERSCHEIDUNG ---

  if (!denonAn) {
    // FALL: Denon ist AUS (Kaltstart)
    setState(ID_DENON_POWER, true);
    delay = 8000; // 8 Sekunden warten, bis Denon bereit ist
    if (config.volCold) volume = config.volCold; // Spezialfall Jazzgroove (Vol 15)
    console.log(`[Radio] Denon Kaltstart für ${config.name}`);
  } else {
    // FALL: Denon ist bereits AN
    // Hinweis: hr1 schaltet sofort, andere haben im Original teils 8s delay.
    // Wir vereinheitlichen das hier: Wenn an, dann sofort (0s).
    delay = 0;
    console.log(`[Radio] Denon bereits an, schalte um auf ${config.name}`);
  }

  // --- AUSFÜHRUNG ---

  // HEOS Befehl senden (Lautstärke & Preset)
  const heosCmd = `set_volume&level=${volume}|play_preset&preset=${config.preset}`;
  setStateDelayed(ID_HEOS_COMMAND, heosCmd, delay, false);

  // Status-Datenpunkt setzen (mit 1 Sek. Puffer)
  setStateDelayed(ID_RADIO_STATUS, true, 1000, false);

  // Benachrichtigungen
  const notifyMsg = `+++ Radio im Wohnzimmer läuft (${config.name}) +++`;
  sendGlobalNotify(notifyMsg, "Radio", 1);
});
