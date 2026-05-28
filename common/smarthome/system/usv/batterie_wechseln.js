// --- KONFIGURATION ---
const upsServerschrank = "nut.0.status.replacebattery";
const upsBuero = "nut.1.status.replacebattery";

// --- HILFSFUNKTION (Meldung) ---
function upsNotify(location) {
  const msg = `+++ 🔋 Die Batterie der USV im ${location} muss ausgetauscht werden! +++`;
  // Harmonisiert: Prio 8 für Hardware-Alarm (Notfall)
  sendGlobalNotify(msg, "USV Wartung", 8);
}

// --- LOGIK ---
on({ id: [upsServerschrank, upsBuero], change: "gt" }, (obj) => {
  // Falls der Wert von 0 auf 1 (oder höher) springt
  if (obj.state.val > 0) {
    if (obj.id === upsServerschrank) {
      upsNotify("Serverschrank");
    } else if (obj.id === upsBuero) {
      upsNotify("Büro");
    }
  }
});
