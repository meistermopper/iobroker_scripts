/* eslint-env es2022 */
// --- Konfiguration ---
const ID_ABENDLICHT = "0_userdata.0.Licht.Wohnzimmer.Abendlicht";
const ID_REINIGUNG = "0_userdata.0.Licht.Reinigungsmodus";
// Funktion für Benachrichtigungen
function notify(text) {
  sendGlobalNotify(text, "Beleuchtung", 1);
}

// Zeitplan: Sonnenuntergang
schedule({ astro: "sunset", shift: 0 }, () => {
  if (!getState(ID_REINIGUNG)?.val) {
    notify("+++ 💡 Sonnenuntergang, Abendlicht wurde eingeschaltet. +++");
    // WICHTIG: ack: false (steuere), damit das Switch-Skript triggert
    setState(ID_ABENDLICHT, true, false);
  }
});

// Trigger: Reinigungsmodus wird ausgeschaltet
on({ id: ID_REINIGUNG, change: "ne", val: false }, () => {
  // Prüfen, ob wir zwischen Sonnenuntergang und 23:30 Uhr liegen
  if (compareTime(getAstroDate("sunset"), "23:30", "between")) {
    //console.log("[Abendlicht] Reinigungsmodus beendet - schalte Abendlicht ein.");
    setState(ID_ABENDLICHT, true, false);
  }
});
