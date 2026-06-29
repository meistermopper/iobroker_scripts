// --- KONFIGURATION ---
const ID_STECKDOSE_SCHLAZI =
  "alias.0.schlafzimmer.energie.Schlazi-Steckdose.ENERGY_Power";
const ID_SAT_DEEP_STANDBY = "enigma2.1.main_command.DEEP_STANDBY";
const ID_ZIGBEE_SWITCH_1 = "alias.0.schlafzimmer.energie.bett.state";
const ID_ZIGBEE_SWITCH_2 = "alias.0.schlafzimmer.energie.schrank.state";

let msgTimeout = null;

// --- SCHEDULE: Täglich um 23:30 Uhr ---
schedule("30 23 * * *", async () => {
  // Prüfen, ob die Steckdose überhaupt an ist (sonst ist niemand da/TV schon aus)
  if (getState(ID_STECKDOSE_SCHLAZI)?.val) {
    console.log("Schlafzimmer-Standby: Fahre Systeme herunter...");

    // 1. Geräte ausschalten
    setState(ID_SAT_DEEP_STANDBY, true);
    setState(ID_ZIGBEE_SWITCH_1, false);
    setState(ID_ZIGBEE_SWITCH_2, false);

    // 2. Benachrichtigung mit 1 Minute Verzögerung (damit Deepstandby Zeit hat)
    if (msgTimeout) clearTimeout(msgTimeout);

    msgTimeout = setTimeout(() => {
      const message =
        "+++📡 Sat im Schlafzimmer wurde in Deepstandby geschickt.+++";

      sendGlobalNotify(message, "Schlafzimmer-Standby", 1);
      console.log(`Schlafzimmer-Standby: Meldung gesendet an Thomas & Gotify`);
      msgTimeout = null;
    }, 60000);
  }
});
