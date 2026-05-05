/**
 * Name:   Vaillant-Adapter Restart-Watchdog
 * Zweck:  Echter Neustart der Instanz bei Trigger-Impuls
 */

const ID_TRIGGER = "0_userdata.0.ioBroker.Vaillant_Adapter";
const INSTANCE = "vaillant.0";

let vaillantTimeout = null;

on({ id: ID_TRIGGER, change: "any" }, async (obj) => {
  // 1. Echten Neustart der Instanz auslösen
  try {
    console.warn(
      `Vaillant-Watchdog: Neustart der Instanz ${INSTANCE} eingeleitet`,
    );
    await restartInstanceAsync(INSTANCE);

    // Benachrichtigung (optional, wie bei den anderen Skripten)
    // sendTo('telegram', { text: '🔄 Vaillant Adapter wird neu gestartet.' });
  } catch (err) {
    console.error(`Fehler beim Neustart von ${INSTANCE}: ${err}`);
  }

  // 2. Timer-Handling (falls du den Trigger-Datenpunkt wieder zurücksetzen willst)
  if (vaillantTimeout) clearTimeout(vaillantTimeout);

  vaillantTimeout = setTimeout(() => {
    // Hier könnte man den Trigger-Datenpunkt wieder auf einen Standardwert setzen,
    // falls es kein Taster (Button) sondern ein Schalter ist.
    // setState(ID_TRIGGER, false, true);

    console.log(
      `Vaillant-Watchdog: Neustart-Prozess für ${INSTANCE} abgeschlossen`,
    );
    vaillantTimeout = null;
  }, 5000); // 5 Sekunden Pause bis zum nächsten möglichen Reset
});
