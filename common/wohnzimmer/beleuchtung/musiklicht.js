/* eslint-env es2022 */
// =============================================================================
// MUSIK-LICHTSTEUERUNG v2.0 (OPTIMIERT: OHNE AUDIO-UNTERBRECHUNG)
// =============================================================================

// --- 1. DEFINITIONEN ---
const ID_ILLU = "alias.0.draussen.licht.CURRENT_ILLUMINATION";
const ID_FERNSEHLICHT = "alias.0.wohnzimmer.licht.fernsehlicht.POWER";
const ID_GALAXIE = "alias.0.wohnzimmer.licht.Galaxie.POWER";
const ID_QUADER = "alias.0.wohnzimmer.licht.quader.on";
const ID_SPIRALE = "alias.0.wohnzimmer.licht.spirale.on";

// Harmony Aktivitäten (Musik-Gruppe)
const HARMONY_MUSIK = [
  "harmony.0.Harmony_Wozi.activities.Online_Music",
  "harmony.0.Harmony_Wozi.activities.Plattenspieler",
  "harmony.0.Harmony_Wozi.activities.Chromecast_Musik",
];

let autoModusMusik = false; // Merker für Automatik-Schaltung

// --- 2. HILFSFUNKTIONEN ---

function istDunkelMusik() {
  const lux = getState(ID_ILLU)?.val || 0;
  const istNacht = compareTime(getAstroDate("sunrise"), getAstroDate("goldenHour"), "not between");
  return istNacht || lux <= 300;
}

function musikAktiv() {
  return HARMONY_MUSIK.some((id) => getState(id)?.val === 2);
}

// --- 3. HAUPTLOGIK ---

on({ id: [...HARMONY_MUSIK, ID_ILLU], change: "ne" }, async (obj) => {
  const lux = getState(ID_ILLU)?.val || 0;
  const amHoeren = musikAktiv();
  const quaderAn = getState(ID_QUADER)?.val;
  const istLuxAenderung = obj.id === ID_ILLU;

  // FALL A: MUSIK-MODUS STARTEN
  if (amHoeren && istDunkelMusik() && !quaderAn) {
    autoModusMusik = true;

    setState(ID_FERNSEHLICHT, false); // TV Licht aus
    setStateDelayed(ID_GALAXIE, true, 1000, true);
    setStateDelayed(ID_QUADER, true, 2000, true);

    sendTo("telegram", "send", { text: "+++ 🎵 Musikmodus aktiviert +++" });
  }

  // FALL B: AUSSCHALTEN DURCH AKTIVITÄTS-ENDE
  else if (!amHoeren && quaderAn && !istLuxAenderung) {
    autoModusMusik = false;

    setState(ID_GALAXIE, false);
    setStateDelayed(ID_QUADER, false, 1000, true);
    setStateDelayed(ID_SPIRALE, false, 2000, true);
  }

  // FALL C: ZU HELL WÄHREND MUSIK
  else if (lux > 400 && quaderAn && amHoeren && autoModusMusik) {
    autoModusMusik = false;

    setState(ID_GALAXIE, false);
    setStateDelayed(ID_QUADER, false, 1000, true);

    sendTo("telegram", "send", {
      text: "+++ ☀️ Musiklicht aus (hell genug) +++",
    });
  }
});
