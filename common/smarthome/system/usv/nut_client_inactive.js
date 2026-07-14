/* eslint-env es2022 */
// --- KONFIGURATION ---
const selector = "linux-control.0.*.nut-client";
const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker")?.val;

// --- LOGIK ---
// @ts-expect-error
on({ id: $(selector), change: "lt" }, (obj) => {
  // Da Trigger 'lt' ist: Wechsel von true (1) auf false (0)
  const clientName = obj.channelName || obj.deviceName;
  const msg = `🌰 Der nut-client von ${clientName} ist offline!`;

  // 1. Telegram & Log
  sendTo("telegram", "send", { text: msg });
  console.warn(`NUT-Client Alarm: ${msg}`);

  // 2. Gotify
  if (gotifyToken) {
    httpPost(
      `https://mygotify.meistermopper.de/message?token=${gotifyToken}`,
      {
        title: "ioBroker: System",
        message: msg,
        priority: 5,
      },
      (error) => {
        if (error) console.error(`[Nut Client Inactive] Gotify Fehler: ${error}`);
      },
    );
  }
});
