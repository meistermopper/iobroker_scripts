// =============================================================================
// MONITOR: GOOGLE MINI SCHLAFZIMMER
// =============================================================================

// --- KONFIGURATION ---
const ID_DEVICE_CONNECTED = "chromecast.0.Mini-Schlazi.status.connected"; // Beispiel: Mini-Schlazi

/** @type {any} */
let miniTimeout = null;

// --- MONITOR LOGIK ---
on({ id: ID_DEVICE_CONNECTED, change: "ne" }, (obj) => {
  // Falls das Gerät offline geht (val == false)
  if (!obj.state.val) {
    if (!miniTimeout) {
      console.log("Google Mini offline erkannt. Starte 2-Minuten-Timer...");

      miniTimeout = setTimeout(() => {
        miniTimeout = null;

        // Nach 2 Minuten prüfen: Ist es immer noch offline?
        if (!getState(ID_DEVICE_CONNECTED)?.val) {
          const notifyText =
            "⚠️ Der Google Mini im Schlafzimmer hat seit zwei Minuten keine WLAN-Verbindung.";

          // Globale Benachrichtigung
          sendGlobalNotify(notifyText, "ioBroker Status", 1);

          // 3. Log-Eintrag
          console.warn(notifyText);
        }
      }, 120000); // 120.000 ms = 2 Minuten
    }
  } else {
    // Falls das Gerät innerhalb der 2 Minuten wieder online geht
    if (miniTimeout) {
      //console.log('Google Mini rechtzeitig wieder online. Benachrichtigung abgebrochen.');
      clearTimeout(miniTimeout);
      miniTimeout = null;
    }
  }
});
