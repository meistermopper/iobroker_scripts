/**
 * =============================================================================
 * SAUNA SOUND-MASTER v1.2
 * =============================================================================
 * ZWECK: Zeitgesteuerte HEOS-Musik für Bad und Sauna.
 * TRIGGER: 0_userdata.0.Haushalt.sauna_laeuft
 * * TIMING-LOGIK:
 * 1. Bad_unten: Startet 5 Minuten (300.000 ms) nach Aktivierung.
 * 2. Sauna:     Startet 20 Minuten (1.200.000 ms) nach Aktivierung.
 * 3. Stop:      Beide Radios schalten sofort aus, wenn die Sauna-Logik endet.
 * =============================================================================
 */

// --- 1. KONFIGURATION (Pfade aus v2.5) ---
const ID_SAUNA_AKTIV = "0_userdata.0.Haushalt.sauna_laeuft";
const RADIO_SENDER = "smoothjazz";

const HEOS = {
  saunaStatus: "0_userdata.0.heos.Sauna.radio_status",
  saunaSender: "0_userdata.0.heos.Sauna.sender",
  badStatus: "0_userdata.0.heos.Bad.radio_status",
  badSender: "0_userdata.0.heos.Bad.sender",
};

// Merker für die Timer, um sie bei Bedarf abbrechen zu können
let tRadioBad = null;
let tRadioSauna = null;

// --- 2. LOGIK ---
on({ id: ID_SAUNA_AKTIV, change: "ne" }, function (obj) {
  const laeuft = obj.state.val; // Aktueller Status der Sauna-Priorisierung

  if (laeuft === true) {
    // --- SAUNA-MODUS GESTARTET ---
    console.log(
      "[Sound] Sauna-Logik aktiv. Musik-Timer gestartet (Bad 5 Min / Sauna 20 Min).",
    );

    // Timer für Bad_unten (5 Minuten)
    if (tRadioBad) clearTimeout(tRadioBad);
    tRadioBad = setTimeout(function () {
      setState(HEOS.badSender, RADIO_SENDER);
      setState(HEOS.badStatus, true);
      console.log("[Sound] Bad-Radio aktiv (5 Min. Verzögerung erreicht).");
      tRadioBad = null;
    }, 300000);

    // Timer für Sauna (20 Minuten)
    if (tRadioSauna) clearTimeout(tRadioSauna);
    tRadioSauna = setTimeout(function () {
      setState(HEOS.saunaSender, RADIO_SENDER);
      setState(HEOS.saunaStatus, true);
      console.log("[Sound] Sauna-Radio aktiv (20 Min. Verzögerung erreicht).");
      tRadioSauna = null;
    }, 1200000);
  } else {
    // --- SAUNA-MODUS BEENDET ---
    console.log("[Sound] Sauna-Logik beendet. Musik wird gestoppt.");

    // Laufende Einschalt-Timer sofort abbrechen
    if (tRadioBad) {
      clearTimeout(tRadioBad);
      tRadioBad = null;
    }
    if (tRadioSauna) {
      clearTimeout(tRadioSauna);
      tRadioSauna = null;
    }

    // Beide Radios ausschalten
    setState(HEOS.saunaStatus, false);
    setState(HEOS.badStatus, false);
  }
});
