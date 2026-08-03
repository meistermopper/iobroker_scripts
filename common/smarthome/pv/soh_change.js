/* eslint-env es2022 */
// --- KONFIGURATION ---
const dpSoH = "modbus.0.inputRegisters.225.304_State_of_health";

// --- LOGIK ---
on({ id: dpSoH, change: "lt" }, (obj) => {
  const newSoH = obj.state.val;
  const oldSoH = obj.oldState.val;

  const msg = `⚠️ Der SoH der Hausbatterie ist von ${oldSoH}% auf ${newSoH}% gesunken.`;

  sendGlobalNotify(msg, "Batterie", 1);
});
