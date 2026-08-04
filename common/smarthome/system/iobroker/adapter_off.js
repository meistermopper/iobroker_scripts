/* eslint-env es2022 */
const ID_PATTERN = /^system\.adapter\..*\..*\.alive$/;

on({ id: ID_PATTERN, change: "ne" }, async (obj) => {
  // Falls der Adapter auf false geht (ausgestiegen)
  if (obj.state.val === false) {
    // Wir merken uns den Namen/ID lokal für diesen spezifischen Durchlauf
    const adapterId = obj.id; // z.B. system.adapter.admin.0.alive
    const adapterName = obj.channelId; // z.B. system.adapter.admin.0

    // Liste der Adapter, die wir ignorieren (Cron-Jobs etc.)
    const ignoreList = ["daswetter", "dwd", "feiertage", "ical", "pollenflug", "proxmox"];

    // Prüfen, ob der Adapter ignoriert werden soll
    const nameOnly = obj.channelName; // Name ohne Instanznummer
    if (ignoreList.includes(nameOnly)) return;

    console.log(`⚠️ Adapter ${adapterName} hat sich abgemeldet. Warte 3 Minuten auf Reconnect`);

    // 3 Minuten warten, bevor Alarm geschlagen wird
    setTimeout(async () => {
      // Aktuellen Status erneut prüfen
      const currentStatus = getState(adapterId);

      if (currentStatus && currentStatus.val === false) {
        const msg = `<b>+++ ⚠️ Der ${adapterName} ist ausgestiegen! +++</b>`;

        // 1. Log-Eintrag
        console.warn(msg);

        // 2. Benachrichtigung
        sendGlobalNotify(msg, "System", 5);
      } else {
        console.log(`✅ Entwarnung: ${adapterName} hat sich wieder gefangen`);
      }
    }, 180000); // 3 Minuten Verzögerung
  }
});
