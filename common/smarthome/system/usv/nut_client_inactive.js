/* eslint-env es2022 */
// --- KONFIGURATION ---
const selector = "linux-control.0.*.nut-client";
// --- LOGIK ---
// @ts-expect-error
on({ id: $(selector), change: "lt" }, (obj) => {
  // Da Trigger 'lt' ist: Wechsel von true (1) auf false (0)
  const clientName = obj.channelName || obj.deviceName;
  const msg = `🌰 Der nut-client von ${clientName} ist offline!`;
  console.warn(`NUT-Client Alarm: ${msg}`);

  // Benachrichtigung
  sendGlobalNotify(msg, "USV / System", 5);
});
