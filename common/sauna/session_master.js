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
 * 1. Automatik: Startet zeitversetzt Radio im Bad und in der Sauna,
 *    sobald der Sauna-Modus aktiviert wird.
 * 2. Lautstärke-Management: Setzt beim Start individuelle Lautstärken.
 * 3. Benachrichtigung: Nutzt das globale System (sendGlobalNotify).
 * 4. Flexibilität: Favoriten-Sender am Skriptanfang konfigurierbar.
 * 5. Lichtsteuerung: Schaltet das Saunalicht synchron mit dem Radio.
 * 6. Nachlauf: Schaltet Musik im Bad nach 15 Minuten sowie Musik und Licht
 *    in der Sauna nach 25 Minuten automatisch aus.
 * =============================================================================
 */

// =============================================================================
// --- KONFIGURATION / STEUERUNGSVARIABLEN ---
// =============================================================================

// 1. Trigger-Datenpunkt (wird von sauna_guardian.js geschaltet)
const ID_SAUNA_AKTIV = "0_userdata.0.Haushalt.sauna_laeuft";

// 2. Audio-Einstellungen
const PREFERED_SENDER = "smoothjazz"; // Standard-Sender für Automatik (Schlüssel aus saunaMap)
const VOL_SAUNA = 10; // Start-Lautstärke Sauna HEOS (0 - 100)
const _VOL_BAD = 15; // Referenz-Lautstärke Bad während Sauna (wird in bad_unten/radio.js gesteuert)

// 3. Einschaltverzögerungen (nach Aktivierung des Sauna-Modus)
const DELAY_BAD_START = 1 * 60 * 1000; // Einschaltverzögerung Radio Bad (z. B. 1 Minute)
const DELAY_SAUNA_START = 20 * 60 * 1000; // Einschaltverzögerung Radio Sauna (z. B. 20 Minuten)

// 4. Nachlauf- und Ausschaltverzögerungen (nach Deaktivierung des Sauna-Modus)
const DELAY_BAD_OFF = 15 * 60 * 1000; // Nachlauf Bad-Musik: Ausschalten nach 15 Minuten
const DELAY_SAUNA_OFF = 25 * 60 * 1000; // Nachlauf Sauna (Musik & Licht): Ausschalten nach 25 Minuten

// 5. Temperatur-Standardwerte
const DEFAULT_TARGET_TEMP = 80; // Fallback-Zieltemperatur in °C bei fehlendem Adapterwert

// =============================================================================
// --- DATENPUNKTE & PRESETS ---
// =============================================================================

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

// =============================================================================
// --- TIMER-VERWALTUNG ---
// =============================================================================

let tAutoBad = null;
let tAutoSauna = null;
let tOffBad = null;
let tOffSauna = null;

/**
 * Stoppt alle laufenden Einschalt- und Nachlauf-Timer
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
  if (tOffBad) {
    clearTimeout(tOffBad);
    tOffBad = null;
  }
  if (tOffSauna) {
    clearTimeout(tOffSauna);
    tOffSauna = null;
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
    }, DELAY_BAD_START);

    // Sauna verzögert einschalten
    tAutoSauna = setTimeout(() => {
      setState(IDS.saunaSender, PREFERED_SENDER);
      tAutoSauna = null;
    }, DELAY_SAUNA_START);
  } else {
    sendGlobalNotify(
      "⏹️ Sauna-Modus beendet: Musik im Bad schaltet in 15 Min. aus, Sauna (Musik & Licht) in 25 Min.",
      "Radio Master",
      1,
    );
    clearAutoTimers();

    // Bad-Musik zeitverzögert nach 15 Minuten ausschalten
    tOffBad = setTimeout(() => {
      const wasPlaying = getState(IDS.badStatus)?.val;

      setState(IDS.badStatus, false);
      setState(IDS.badSender, "");
      tOffBad = null;

      if (wasPlaying) {
        sendGlobalNotify(
          "⏹️ Bad-Nachlauf beendet: Musik im Bad wurde nach 15 Minuten ausgeschaltet.",
          "Radio Master",
          1,
        );
      }
    }, DELAY_BAD_OFF);

    // Sauna-Musik und Licht zeitverzögert nach 25 Minuten ausschalten
    tOffSauna = setTimeout(() => {
      const wasPlaying = getState(IDS.saunaStatus)?.val;
      const lightWasOn = getState(IDS.saunaLight)?.val;

      setState(IDS.saunaStatus, false);
      setState(IDS.saunaSender, "");
      setState(IDS.saunaLight, false);
      tOffSauna = null;

      if (wasPlaying || lightWasOn) {
        sendGlobalNotify(
          "⏹️ Sauna-Nachlauf beendet: Musik und Licht in der Sauna wurden nach 25 Minuten ausgeschaltet.",
          "Radio Master",
          1,
        );
      }
    }, DELAY_SAUNA_OFF);
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
    const targetTemp = getState(IDS.saunaTargetTemp)?.val || DEFAULT_TARGET_TEMP;
    const msg = `🧖 Die Sauna erreicht in ca. 10 Minuten ihre Zieltemperatur (${targetTemp}°C).`;
    console.log(`[Sauna] ${msg}`);
    sendGlobalNotify(msg, "Sauna", 1);
  }
});

// Zieltemperatur erreicht
on({ id: IDS.saunaTargetReachedNotified, change: "ne" }, (obj) => {
  if (obj.state.val) {
    const targetTemp = getState(IDS.saunaTargetTemp)?.val || DEFAULT_TARGET_TEMP;
    const msg = `♨️ Die Sauna hat ihre Zieltemperatur von ${targetTemp}°C erreicht und ist bereit!`;
    console.log(`[Sauna] ${msg}`);
    sendGlobalNotify(msg, "Sauna", 1);
  }
});

/**
 * 5. LIFECYCLE CLEANUP
 * Ensures all timers are cleared when the script stops or restarts.
 */
onStop((callback) => {
  clearAutoTimers();
  callback();
});
