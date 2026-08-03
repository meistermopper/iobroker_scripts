/* eslint-env es2022 */
// --- KONFIGURATION ---
const dpBatteryTemp = "modbus.0.inputRegisters.225.262_Battery_temp";
const TEMP_LIMIT = 350; // Entspricht 35,0 °C
// --- HILFSFUNKTION (Lokale Meldung) ---
function tempNotify(msg) {
  console.log(`Batterie-Warnung: ${msg}`);
  sendGlobalNotify(msg, "Batterie", 5);
}

// --- LOGIK ---
on({ id: dpBatteryTemp, change: "ne" }, (obj) => {
  const rawTemp = obj.state.val;
  const oldRawTemp = obj.oldState.val;

  // Prüfung: Limit überschritten? (Flanken-Erkennung, damit nicht bei jedem Grad gewarnt wird)
  if (rawTemp > TEMP_LIMIT && oldRawTemp <= TEMP_LIMIT) {
    // Umrechnung: 350 -> 35.0
    const celsius = Math.round((rawTemp / 10) * 10) / 10;

    const warnMsg = `+++ 🥵 Die Batterietemperatur liegt bei ${celsius} °C. +++`;
    tempNotify(warnMsg);
  }
});
