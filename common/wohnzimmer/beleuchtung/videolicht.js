// =============================================================================
// KINO-LICHTSTEUERUNG v2.0 (OPTIMIERT: OHNE AUDIO-UNTERBRECHUNG)
// =============================================================================

// --- 1. DEFINITIONEN ---
const ID_ILLU = "alias.0.draussen.licht.CURRENT_ILLUMINATION";
const ID_FERNSEHLICHT = "alias.0.wohnzimmer.licht.fernsehlicht.POWER";
const ID_GALAXIE = "alias.0.wohnzimmer.licht.Galaxie.POWER";
const ID_QUADER = "alias.0.wohnzimmer.licht.quader.on";
const ID_SPIRALE = "alias.0.wohnzimmer.licht.spirale.on";
const ID_WEIHNACHTEN = "alias.0.wohnzimmer.licht.weihnachtsbaum.on";

const HARMONY_VIDEO = [
  "harmony.0.Harmony_Wozi.activities.Chromecast_Video",
  "harmony.0.Harmony_Wozi.activities.SAT_TV",
  "harmony.0.Harmony_Wozi.activities.Bluray",
];

// --- 2. HILFSFUNKTIONEN ---

function istDunkel() {
  const lux = getState(ID_ILLU).val || 0;
  const istNacht = compareTime(
    getAstroDate("sunrise"),
    getAstroDate("sunset"),
    "not between",
  );
  return istNacht || lux <= 1000;
}

function videoAktiv() {
  return HARMONY_VIDEO.some((id) => getState(id).val === 2);
}

// --- 3. HAUPTLOGIK ---

on({ id: [...HARMONY_VIDEO, ID_ILLU], change: "ne" }, async (obj) => {
  const lux = getState(ID_ILLU).val || 0;
  const tvLichtAn = getState(ID_FERNSEHLICHT).val;
  const amSchauen = videoAktiv();

  // Feststellen, ob der Trigger der Lux-Sensor war
  const istLuxAenderung = obj.id === ID_ILLU;

  // FALL A: KINO-MODUS STARTEN (Licht anpassen)
  if (amSchauen && istDunkel() && !tvLichtAn) {
    // Galaxie nur an, wenn der Weihnachtsbaum aus ist
    if (!getState(ID_WEIHNACHTEN).val) {
      setState(ID_GALAXIE, true);
    }

    setStateDelayed(ID_QUADER, false, 1000, true);
    setStateDelayed(ID_SPIRALE, false, 2000, true);
    setStateDelayed(ID_FERNSEHLICHT, true, 3000, true);
  }

  // FALL B: AUSSCHALTEN (Nur wenn Video beendet wurde und NICHT durch Lux-Änderung)
  else if (!amSchauen && tvLichtAn && !istLuxAenderung) {
    setState(ID_GALAXIE, false);
    setStateDelayed(ID_QUADER, false, 1000, true);
    setStateDelayed(ID_SPIRALE, false, 2000, true);
    setStateDelayed(ID_FERNSEHLICHT, false, 3000, true);
  }

  // FALL C: ZU HELL (Reaktion auf Helligkeit während des Schauens)
  else if (lux > 1500 && tvLichtAn && amSchauen) {
    setState(ID_FERNSEHLICHT, false);
    setStateDelayed(ID_GALAXIE, false, 500, true);
  }
});
