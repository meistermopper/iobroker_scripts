let timeout_ventilator;
let wasReportedOffline = false;

const ID_ONLINE = "alias.0.wohnzimmer.klima.ventilator.online";

on({ id: ID_ONLINE, change: "ne" }, async (obj) => {
  const isOnline = obj.state.val;

  // Timer immer löschen, wenn sich der Status ändert
  if (timeout_ventilator) {
    clearTimeout(timeout_ventilator);
    timeout_ventilator = null;
  }

  if (!isOnline) {
    // --- OFFLINE LOGIK ---
    // Wir warten 2 Minuten, ob er wirklich weg bleibt
    timeout_ventilator = setTimeout(() => {
      timeout_ventilator = null;

      // Nochmal prüfen, ob er immer noch offline ist
      if (!getState(ID_ONLINE)?.val) {
        const msg = "🛞 Der Deckenventilator ist offline.";
        sendTo("telegram", "send", { text: msg });
        console.warn(msg);
        wasReportedOffline = true;
      }
    }, 120000); // 120 Sekunden
  } else if (isOnline) {
    // --- ONLINE LOGIK ---
    if (wasReportedOffline) {
      const msg = "🛞 Der Deckenventilator ist wieder online.";
      sendTo("telegram", "send", { text: msg });
      console.log(msg);
      wasReportedOffline = false;
    }
  }
});
