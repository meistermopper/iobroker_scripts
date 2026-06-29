/**
 * Name:   Tasmota MQTT-Watchdog
 * Zweck:  Überwacht die Erreichbarkeit (alive) aller Sonoff-Geräte
 */

const ID_SELECTOR = "sonoff.0.*.alive";

on({ id: $(ID_SELECTOR), change: "ne" }, (obj) => {
  // Wenn 'alive' auf false geht, ist das Gerät offline
  if (obj.state.val === false) {
    const deviceName = obj.channelName || "Unbekanntes Gerät";
    const message = `📡 <b>Keine MQTT-Verbindung</b> zum Schalter: <b>${deviceName}</b>!`;

    // Telegram-Benachrichtigung
    sendTo("telegram", "send", {
      text: message,
      parse_mode: "HTML",
    });

    // Gotify-Benachrichtigung (als Ergänzung für deine Infrastruktur)
    const token = getState("0_userdata.0.gotifytoken.iobroker")?.val;
    if (token) {
      httpPost(`https://mygotify.meistermopper.de/message?token=${token}`, {
        title: "Verbindungsabbruch",
        message: `MQTT offline: ${deviceName}`,
        priority: 2
      }, (error) => {
        if (error) console.error(`[Sonoff Fail] Gotify Fehler: ${error}`);
      });
    }

    console.warn(`Watchdog: ${deviceName} ist offline`);
  }
  // Optional: Meldung, wenn das Gerät wieder online kommt
  else if (obj.state.val === true && obj.oldState.val === false) {
    console.log(`Watchdog: ${obj.channelName} ist wieder online.`);
  }
});
