/* eslint-env es2022 */
/**
 * Smart Tablet Charging & Screen Control
 * Steuert die Ladestation eines Wandtablets zur Akkuschonung (30-70% Strategie)
 * und verwaltet das automatische Ausschalten des Displays.
 */

// Variable zum Speichern des Timeouts, um laufende Timer löschen zu können
let screenTimeout;

/**
 * Funktion zum verzögerten Ausschalten des Bildschirms.
 * Verhindert das "Einbrennen" und spart Energie, falls das Display durch
 * das Einstecken des Ladekabels aktiviert wurde.
 */
function scheduleScreenOff() {
  // Falls bereits ein Timer läuft, löschen wir ihn (Reset des Countdowns)
  if (screenTimeout) {
    clearTimeout(screenTimeout);
  }

  // Setze einen neuen Timer für 20 Sekunden
  screenTimeout = setTimeout(() => {
    screenTimeout = null;

    // Sende den Befehl an den Fully Browser Adapter, das Display komplett abzuschalten
    setState("fullybrowser.0.Fully-Browser.Commands.screenOff", true);

    //console.log('Tablet-Display wurde automatisch abgeschaltet.');
  }, 20000); // 20.000 ms = 20 Sekunden
}

// Trigger: Reagiert auf jede Änderung des Batteriestands
on({ id: "fullybrowser.0.Fully-Browser.Info.batteryLevel", change: "ne" }, async (obj) => {
  // Aktueller Batteriewert aus dem Trigger-Objekt
  const currentBatt = obj.state.val;
  // Vorheriger Batteriewert (für Sinkflug-Prüfung)
  const oldBatt = obj.oldState ? obj.oldState.val : currentBatt;

  // Status der Ladesteckdose abrufen (true = Tablet wird geladen)
  const isCharging = getState("alias.0.wohnzimmer.energie.fully.POWER")?.val;

  /**
   * LOGIK 1: LADEN STARTEN
   * Wenn der Akku unter 30% fällt und die Steckdose noch aus ist.
   */
  if (currentBatt < 30 && !isCharging) {
    //console.log(`Akku niedrig (${currentBatt}%). Starte Ladevorgang.`);
    setState("alias.0.wohnzimmer.energie.fully.POWER", true);

    // Nach dem Einschalten der Dose geht oft das Display an -> Ausschalten planen
    scheduleScreenOff();
  } else if (currentBatt >= 70 && isCharging) {
    /**
     * LOGIK 2: LADEN STOPPEN
     * Wenn der Akku die Zielmarke von 70% erreicht hat und gerade geladen wird.
     * (Akkuschonung: Idealbereich liegt meist zwischen 20% und 80%)
     */
    //console.log(`Ziel-Ladestand erreicht (${currentBatt}%). Beende Ladevorgang.`);
    setState("alias.0.wohnzimmer.energie.fully.POWER", false);

    // Auch beim Ausstecken/Abschalten kann das Display reagieren -> Ausschalten planen
    scheduleScreenOff();
  } else if (currentBatt < 28 && currentBatt < oldBatt) {
    /**
     * LOGIK 3: ALARM-SYSTEM
     * Wenn der Akku unter 28% ist UND der Wert weiter sinkt (trotz Ladewunsch).
     * Dies deutet auf ein defektes Kabel oder eine hängende Steckdose hin.
     */
    const message = `Achtung: Wandtablet lädt nicht korrekt, Stand: ${currentBatt}% (Sinkend)`;
    console.error(message);
    await sendGlobalNotify(
      message,
      "",
      2,
      compareTime("08:00", "20:00", "between") ? 40 : null, // Sprachausgabe nur tagsüber
    );
  }
});
