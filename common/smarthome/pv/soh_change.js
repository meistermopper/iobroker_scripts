// --- KONFIGURATION ---
const dpSoH = "modbus.0.inputRegisters.225.304_State_of_health";
const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker")?.val;

// --- LOGIK ---
on({ id: dpSoH, change: "lt" }, (obj) => {
  const newSoH = obj.state.val;
  const oldSoH = obj.oldState.val;

  const msg = `⚠️ Der SoH der Hausbatterie ist von ${oldSoH}% auf ${newSoH}% gesunken.`;

  // Benachrichtigungen
  sendTo("telegram", "send", { text: msg });
  console.log(`Batterie-SoH: ${msg}`);

  exec(
    `curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker: Batterie" -F "message=${msg}" -F "priority=1"`,
  );
});
