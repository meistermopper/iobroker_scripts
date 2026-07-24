/* eslint-env es2022 */
/**
 * =============================================================================
 * RADIO MASTER-STEUERUNG v3.1 (Sauna & Bad)
 * =============================================================================
 * ZWECK:
 * Zentrale Steuerung der HEOS-Musik für Sauna und Bad. Das Skript reagiert
 * sowohl auf manuelle Eingaben als auch auf den Sauna-Hauptschalter.
 *
 * FUNKTIONEN:
 * 1. Automatik: Startet zeitversetzt Radio im Bad (5 Min) und Sauna (20 Min),
 *    sobald der Sauna-Modus aktiviert wird.
 * 2. Lautstärke-Management: Setzt beim Start individuelle Lautstärken.
 * 3. Benachrichtigung: Nutzt das globale System (sendGlobalNotify).
 * 4. Flexibilität: Favoriten-Sender am Skriptanfang konfigurierbar.
 * 5. Lichtsteuerung: Schaltet das Saunalicht synchron mit dem Radio.
 * =============================================================================
 */

// --- KONFIGURATION ---
const ID_SAUNA_AKTIV = "0_userdata.0.Haushalt.sauna_laeuft"; // Trigger für Automatik
const PREFERED_SENDER = "smoothjazz"; // Standard-Sender für Automatik
const VOL_SAUNA = 10; // Start-Lautstärke Sauna
const _VOL_BAD = 15; // Start-Lautstärke Bad

const DELAY_BAD = 5 * 60 * 1000; // Einschaltverzögerung Bad
const DELAY_SAUNA = 20 * 60 * 1000; // Einschaltverzögerung Sauna

// Datenpunkt-Pfade
const IDS = {
  saunaPlayer: "alias.0.sauna.media.heos", // HEOS Gerät Sauna
  saunaSender: "0_userdata.0.heos.Sauna.sender", // Auswahl-Datenpunkt Sauna
  saunaStatus: "0_userdata.0.heos.Sauna.radio_status", // An/Aus Status Sauna
  saunaLight: "harvia-fenix.0.lightOn", // Sauna Licht (über harvia-fenix Adapter)
  badPlayer: "alias.0.bad_unten.media.heos", // HEOS Gerät Bad
  badSender: "0_userdata.0.heos.Bad.sender", // Auswahl-Datenpunkt Bad
  badStatus: "0_userdata.0.heos.Bad.radio_status", // An/Aus Status Bad

  // Harvia Fenix Adapter Benachrichtigungs-Datenpunkte
  sauna10MinNotified: "harvia-fenix.0.readyNotified10Min",
  saunaTargetReachedNotified: "harvia-fenix.0.targetReachedNotified",
  saunaTargetTemp: "harvia-fenix.0.targetTemp",
};

// Sender-Liste: Key -> HEOS Preset (muss in der HEOS App unter Favoriten gespeichert sein)
const saunaMap = {
  jazzgroove: { preset: 1, name: "The Jazz Groove" },
  jazzradio: { preset: 2, name: "Jazz Radio" },
  smoothjazz: { preset: 3, name: "Smoothjazz" },
  hr1: { preset: 4, name: "HR 1" },
  hrinfo: { preset: 5, name: "hr info" },
  swissjazz: { preset: 6, name: "Swiss Jazz" },
  mdrkultur: { preset: 7, name: "MDR Kultur" },
  jazzloft: { preset: 10, name: "Jazz Loft" },
};

// Timer für die Automatik
let tAutoBad = null;
let tAutoSauna = null;

/**
 * Stoppt laufende Einschalt-Timer
 */
function clearAutoTimers() {
  if (tAutoBad) {
    clearTimeout(tAutoBad);
    tAutoBad = null;
  }
  if (tAutoSauna) {
    clearTimeout(tAutoSauna);
    tAutoSauna = null;
  }
}

// --- LOGIK ---

/**
 * 1. AUTOMATIK-TRIGGER (Sauna Master-Schalter)
 */
on({ id: ID_SAUNA_AKTIV, change: "ne" }, (obj) => {
  const isStarting = !!obj.state.val;

  if (isStarting) {
    sendGlobalNotify("🧖 Sauna-Modus aktiv: Musik-Automatik gestartet.", "Radio Master", 1);
    clearAutoTimers();

    // Bad verzögert einschalten
    tAutoBad = setTimeout(() => {
      setState(IDS.badSender, PREFERED_SENDER);
      tAutoBad = null;
    }, DELAY_BAD);

    // Sauna verzögert einschalten
    tAutoSauna = setTimeout(() => {
      setState(IDS.saunaSender, PREFERED_SENDER);
      tAutoSauna = null;
    }, DELAY_SAUNA);
  } else {
    sendGlobalNotify("⏹️ Sauna-Modus beendet: Musik wird gestoppt.", "Radio Master", 1);
    clearAutoTimers();

    // Alles ausschalten und Auswahl zurücksetzen
    setState(IDS.saunaStatus, false);
    setState(IDS.badStatus, false);
    setState(IDS.saunaSender, "");
    setState(IDS.badSender, "");
  }
});

/**
 * 2. MANUELLER STATUS-TRIGGER (Play/Stop)
 * Steuert die Hardware basierend auf dem Status-Datenpunkt.
 */
on({ id: IDS.saunaStatus, change: "ne" }, (obj) => {
  const isPlaying = !!obj.state.val;
  const saunaAktiv = getState(ID_SAUNA_AKTIV)?.val;

  setState(`${IDS.saunaPlayer}.state`, isPlaying ? "play" : "stop");
  setState(IDS.saunaLight, isPlaying); // Licht folgt dem Radio-Status

  // Benachrichtigung nur senden, wenn manuell ausgeschaltet wurde (Sauna läuft noch)
  if (!isPlaying && saunaAktiv) {
    sendGlobalNotify("+++ 📻 ⏹️ Radio in der Sauna wurde ausgeschaltet +++", "Radio Sauna", 1);
  }
});

/**
 * 3. SENDER-TRIGGER
 * Wird ausgelöst, wenn im Datenpunkt ein neuer Sendername gesetzt wird.
 */
on({ id: IDS.saunaSender, change: "any" }, (obj) => {
  if (!obj.state.val) return; // Leere Sender (Reset) ignorieren

  // RACE CONDITION PROTECTION: Automatik-Timer stoppen, wenn manuell gewählt wird
  if (tAutoSauna) {
    clearTimeout(tAutoSauna);
    tAutoSauna = null;
  }

  const senderKey = obj.state.val;
  const sender = saunaMap[senderKey];

  if (sender) {
    // HEOS Command Syntax: Lautstärke setzen UND Preset abspielen in einem String
    // Das Trennzeichen | erlaubt das Verketten von Befehlen.
    const cmd = `set_volume&level=${VOL_SAUNA}|play_preset&preset=${sender.preset}`;

    // Befehl an den HEOS Adapter senden
    setState(`${IDS.saunaPlayer}.command`, cmd);

    // Den Status-Datenpunkt zeitverzögert auf 'true' setzen (Synchronisation)
    setStateDelayed(IDS.saunaStatus, true, 1000, true);

    sendGlobalNotify(`+++ 📻 ▶️ Radio in der Sauna läuft (${sender.name}) +++`, "Radio Sauna", 1);
  } else {
    console.warn(`Sauna: Sender '${senderKey}' ist nicht in der saunaMap konfiguriert.`);
  }
});

/**
 * 4. SAUNA-BENACHRICHTIGUNGEN (harvia-fenix.0 Adapter)
 */

// 10-Minuten Vorwarnung
on({ id: IDS.sauna10MinNotified, change: "ne" }, (obj) => {
  if (obj.state.val) {
    const targetTemp = getState(IDS.saunaTargetTemp)?.val || 80;
    const msg = `🧖 Die Sauna erreicht in ca. 10 Minuten ihre Zieltemperatur (${targetTemp}°C).`;
    console.log(`[Sauna] ${msg}`);
    sendGlobalNotify(msg, "Sauna", 1);
  }
});

// Zieltemperatur erreicht
on({ id: IDS.saunaTargetReachedNotified, change: "ne" }, (obj) => {
  if (obj.state.val) {
    const targetTemp = getState(IDS.saunaTargetTemp)?.val || 80;
    const msg = `♨️ Die Sauna hat ihre Zieltemperatur von ${targetTemp}°C erreicht und ist bereit!`;
    console.log(`[Sauna] ${msg}`);
    sendGlobalNotify(msg, "Sauna", 1);
  }
});
