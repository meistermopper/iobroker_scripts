let timeout_screen;
const ID_MOTION = "fullybrowser.0.Fully-Browser.Events.onMotion";
const ID_HELL = "0_userdata.0.Fully.hell";
const ID_COMMAND = "fullybrowser.0.Fully-Browser.Commands."; // Basis-Pfad für Commands

const BRI_HOCH = 200;

// Hilfsfunktion: Prüfen ob wir uns in der Nachtruhe befinden
function isNachtruhe() {
  const jetzt = new Date();
  const stunde = jetzt.getHours();
  // Nachtruhe von 23:00 bis 05:00 Uhr
  return stunde >= 23 || stunde < 5;
}

// --- LOGIK ---

on({ id: ID_MOTION, change: "gt" }, async () => {
  // 1. Sperre: Wenn Nachtruhe, dann mache gar nichts
  if (isNachtruhe()) return;

  // Alten Timer löschen
  if (timeout_screen) {
    clearTimeout(timeout_screen);
    timeout_screen = null;
  }

  // Display einschalten und Helligkeit setzen
  setState(ID_COMMAND + "screenOn", true);
  setState(
    ID_COMMAND + "setStringSetting",
    `&key=screenBrightness&value=${BRI_HOCH}`,
  );

  // Timer für das Ausschalten starten
  timeout_screen = setTimeout(async () => {
    timeout_screen = null;

    // Nur ausschalten, wenn der manuelle "hell"-Schalter nicht aktiv ist
    const stateHell = await getStateAsync(ID_HELL);
    if (stateHell && !stateHell.val) {
      setState(ID_COMMAND + "screenOff", true);
      //console.log("[Fully] Display per Timeout ausgeschaltet.");
    }
  }, 30000); // 30 Sekunden
});

// Manueller Schalter (bleibt aktiv, egal wie spät es ist)
on({ id: ID_HELL, change: "ne" }, (obj) => {
  if (obj.state.val) {
    setState(ID_COMMAND + "screenOn", true);
    setState(
      ID_COMMAND + "setStringSetting",
      `&key=screenBrightness&value=${BRI_HOCH}`,
    );
  } else {
    setState(ID_COMMAND + "screenOff", true);
  }
});
