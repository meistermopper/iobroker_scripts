/* eslint-env es2022 */
// --- KONFIGURATION ---
const ID_RECEIVER_STANDBY = "enigma2.1.enigma2.STANDBY";
const ID_ZIGBEE_LICHT = "alias.0.schlafzimmer.energie.bett.state";

// --- LOGIK ---

on({ id: ID_RECEIVER_STANDBY, change: "ne" }, async (obj) => {
  const isStandby = obj.state.val; // true = Gerät im Standby, false = Gerät AN

  // WENN Gerät AN (false) UND Zeit zwischen Sonnenuntergang und 23:30 Uhr
  if (!isStandby && compareTime(getAstroDate("sunset"), "23:30", "between")) {
    setState(ID_ZIGBEE_LICHT, true);
    //console.log("Schlafzimmer: Receiver AN & es ist dunkel. Licht eingeschaltet.");
  } else {
    // In allen anderen Fällen (Receiver geht aus ODER es ist außerhalb des Zeitfensters)
    // Das Licht soll nur automatisch ausgehen, wenn der Receiver in Standby geht
    if (isStandby) {
      setState(ID_ZIGBEE_LICHT, false);
      //console.log("Schlafzimmer: Receiver Standby. Licht ausgeschaltet.");
    }
  }
});
