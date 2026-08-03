/* eslint-env es2022 */
/**
 * Name:   Tasmota MQTT-Watchdog
 * Zweck:  Überwacht die Erreichbarkeit (alive) aller Sonoff-Geräte
 */

const ID_SELECTOR = "sonoff.0.*.alive";

// @ts-expect-error
on({ id: $(ID_SELECTOR), change: "ne" }, (obj) => {
  // Wenn 'alive' auf false geht, ist das Gerät offline
  if (obj.state.val === false) {
    const deviceName = obj.channelName || "Unbekanntes Gerät";
    const message = `📡 <b>Keine MQTT-Verbindung</b> zum Schalter: <b>${deviceName}</b>!`;

    // Benachrichtigung
    sendGlobalNotify(message, "Verbindungsabbruch", 2);

    console.warn(`Watchdog: ${deviceName} ist offline`);
  }
  // Optional: Meldung, wenn das Gerät wieder online kommt
  else if (obj.state.val === true && obj.oldState.val === false) {
    console.log(`Watchdog: ${obj.channelName} ist wieder online.`);
  }
});
