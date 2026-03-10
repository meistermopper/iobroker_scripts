/**
 * Schrank-Licht Steuerung (Aqara BWM)
 * Berücksichtigt die 90s Hardware-Blindzeit des Sensors
 */

const ID_OCCUPANCY = "alias.0.schlafzimmer.energie.schrank.occupancy";
const ID_ILLUMINANCE = "alias.0.schlafzimmer.energie.schrank.illuminance_raw";
const ID_SWITCH = "alias.0.schlafzimmer.energie.schrank.state";

// Kurze Nachlaufzeit, da der Aqara selbst schon ca. 90s verzögert
const POST_MOTION_DELAY = 10000;
const LUX_THRESHOLD = 10;

let offTimer = null;

on({ id: ID_OCCUPANCY, change: "ne" }, (obj) => {
  const isMotion = !!obj.state.val;
  const lightAlreadyOn = getState(ID_SWITCH).val === true;

  // Bestehenden Timer stoppen, wenn der Sensor reagiert
  if (offTimer) {
    clearTimeout(offTimer);
    offTimer = null;
  }

  if (isMotion) {
    // Einschalten wenn es dunkel ist ODER wenn es bereits an ist (Bewegung verlängern)
    const currentLux = getState(ID_ILLUMINANCE).val;

    if (lightAlreadyOn || currentLux <= LUX_THRESHOLD) {
      if (!lightAlreadyOn) {
        setState(ID_SWITCH, true);
      }
    }
  } else {
    // Sensor geht auf 'false' (nach seinen internen 90s)
    // Jetzt startet die kurze 10s Sicherheits-Nachlaufzeit
    if (lightAlreadyOn) {
      offTimer = setTimeout(() => {
        setState(ID_SWITCH, false);
        offTimer = null;
      }, POST_MOTION_DELAY);
    }
  }
});
