/* eslint-env es2022 */
/**
 * Name:   Kachelofen Ventilator
 * Zweck:  Steuert den Ventilator im Wohnzimmer abhängig von der Temperatur und Jahreszeit.
 *         - Im Winter (Heizmonate) schaltet er sich bei >= 23°C Kachelofentemperatur ein (Drehrichtung: rückwärts, Stufe 1).
 *         - Im Sommer (Kühlmonate) schaltet er sich bei >= 25°C ein (Drehrichtung: vorwärts, Stufe 1). Ab >= 27°C wechselt er auf Stufe 2.
 */

// --- KONFIGURATION ---
// Datenpunkte für Temperaturen
const ID_TEMP_KACHELOFEN = "alias.0.wohnzimmer.klima.kachelofen.temperature"; // Trigger-Temperatur
const ID_TEMP_WOHNZIMMER = "alias.0.wohnzimmer.heizung.ACTUAL_TEMPERATURE"; // Referenz-Temperatur (z.B. für Benachrichtigungen im Sommer)

// Datenpunkte für den Ventilator (Tuya)
const ID_FAN_SWITCH = "alias.0.wohnzimmer.klima.ventilator.1"; // Ein-/Ausschalten (true/false)
const ID_FAN_SPEED = "alias.0.wohnzimmer.klima.ventilator.3"; // Geschwindigkeit (0 = Stufe 1, 1 = Stufe 2, etc.)
const ID_FAN_DIRECTION = "alias.0.wohnzimmer.klima.ventilator.4"; // Drehrichtung (0 = vorwärts/Sommer, 1 = rückwärts/Winter)
const ID_FAN_ONLINE = "alias.0.wohnzimmer.klima.ventilator.online"; // Erreichbarkeit des Ventilators im Netzwerk

// Sonstige System-Datenpunkte
const ID_HEIZPERIODE = "0_userdata.0.Energie.heizperiode"; // Zeigt an, ob aktuell die Heizperiode aktiv ist (boolean)
const ID_GOTIFY_TOKEN = "0_userdata.0.gotifytoken.iobroker"; // Token für Push-Benachrichtigungen über Gotify

// --- VARIABLEN ---
// Diese Variable verhindert, dass der Ventilator mehrfach eingeschaltet wird oder dass
// Offlinestatus-Meldungen zu Spam führen. Sie wird jede Nacht zurückgesetzt.
let einschaltenAktiv = false;

// --- LOGIK ---

/**
 * Hilfsfunktion: Bestimmt anhand des aktuellen Monats, ob Heizperiode ist.
 * @returns {boolean} true, wenn Winter (Jan-Apr, Sep-Dez), false, wenn Sommer (Mai-Aug)
 */
function isWinter() {
  const month = new Date().getMonth() + 1; // getMonth() liefert 0-11, daher +1
  return month < 5 || month >= 9;
}

/**
 * Hilfsfunktion für Benachrichtigungen
 * Sendet eine Nachricht parallel an Telegram und an den lokalen Gotify-Server.
 * @param {string} msg - Die zu sendende Nachricht
 */
function notify(msg) {
  // 1. Nachricht über den Telegram-Adapter versenden
  sendTo("telegram", "send", { text: msg, user: "Thomas" });

  // 2. Nachricht über Gotify versenden (sofern ein Token vorhanden ist)
  const token = getState(ID_GOTIFY_TOKEN)?.val;
  if (token) {
    // Native httpPost Funktion nutzen, um externe curl Aufrufe zu vermeiden
    httpPost(
      `https://mygotify.meistermopper.de/message?token=${token}`,
      {
        title: "ioBroker Fan",
        message: msg,
        priority: 1,
      },
      (error) => {
        // Fehler im Log ausgeben, falls Gotify nicht erreichbar ist
        if (error) console.error(`[Kachelofen Ventilator] Gotify Fehler: ${error}`);
      },
    );
  }
}

/**
 * Hilfsfunktion zum Einschalten und Konfigurieren des Ventilators.
 * Prüft den Online-Status und setzt dann Switch, Richtung und Geschwindigkeit in der richtigen Reihenfolge.
 * @param {string} reason - Grund für das Einschalten (wird an die Benachrichtigung angehängt)
 * @param {number} speed  - Ziel-Geschwindigkeit (0 = Stufe 1, 1 = Stufe 2)
 */
function turnFanOn(reason, speed = 0) {
  // Prüfen, ob der Ventilator im WLAN erreichbar ist
  if (getState(ID_FAN_ONLINE)?.val) {
    // Jahreszeit bestimmen für die Drehrichtung
    const isHeizmonat = isWinter();

    // Drehrichtung: 1 = rückwärts (Winter), 0 = vorwärts (Sommer)
    const direction = isHeizmonat ? 1 : 0;
    const dirText = isHeizmonat ? "rückwärts" : "vorwärts";

    // 1. Einschalten des Geräts
    setState(ID_FAN_SWITCH, true);

    // 2. Drehrichtung setzen (mit 500ms Verzögerung, damit das Gerät den Befehl sauber nach dem Einschalten annimmt)
    setStateDelayed(ID_FAN_DIRECTION, direction, 500, false);

    // 3. Geschwindigkeit setzen (mit 1000ms Verzögerung)
    setStateDelayed(ID_FAN_SPEED, speed, 1000, false);

    // Flag setzen, damit an diesem Tag nicht nochmals der Initial-Einschalt-Trigger greift
    einschaltenAktiv = true;

    // Vollzugsmeldung senden
    notify(`𖣘 Der Ventilator wurde auf Stufe ${speed + 1} (${dirText}) eingeschaltet. ${reason}`);
  } else {
    // Falls das Gerät offline ist: Flag setzen, damit es später beim Online-Kommen direkt nachgeholt wird
    einschaltenAktiv = true;
    notify(`𖣘 Ventilator offline! Wird eingeschaltet sobald online. ${reason}`);
  }
}

// --- Trigger: Überwachung der Kachelofen-Temperatur ---
// Reagiert auf jede Wertänderung ("ne" = not equal) des Temperatur-Sensors
// @ts-expect-error
on({ id: ID_TEMP_KACHELOFEN, change: "ne" }, (obj) => {
  const temp = obj.state.val; // Aktuelle Temperatur
  const oldTemp = obj.oldState.val; // Vorherige Temperatur (wichtig um Schwellenwerte zu erkennen)

  const isHeizmonat = isWinter(); // Ist gerade Winter/Übergangszeit?
  const isFanOn = getState(ID_FAN_SWITCH)?.val; // Läuft der Ventilator aktuell?

  // ==========================================
  // LOGIK 1: Kachelofen (Winter/Übergangszeit)
  // ==========================================
  if (isHeizmonat) {
    // Einschalt-Bedingung:
    // - Die Temperatur hat gerade die 23°C Marke erreicht oder überschritten
    // - Der Ventilator ist aus
    // - Der Ventilator wurde heute noch nicht regulär eingeschaltet
    if (temp >= 23 && oldTemp < 23 && !isFanOn && !einschaltenAktiv) {
      turnFanOn(`Temperatur am Kachelofen: ${temp}°C.`, 0); // 0 = Stufe 1
    }
  }

  // ==========================================
  // LOGIK 2: Sommer-Modus (Wärme verteilen)
  // ==========================================
  if (!isHeizmonat) {
    // 1. Initiales Einschalten
    // - Temperatur hat gerade die 25°C Marke geknackt
    // - Ventilator ist noch aus und wurde heute nicht schon eingeschaltet
    if (temp >= 25 && oldTemp < 25 && !isFanOn && !einschaltenAktiv) {
      const tempWZ = getState(ID_TEMP_WOHNZIMMER)?.val; // Lese Wohnzimmer-Temp für die Benachrichtigung

      // Falls die Temperatur direkt einen Sprung auf >= 27°C gemacht hat, starte auf Stufe 2 (Wert 1), sonst Stufe 1 (Wert 0)
      const speed = temp >= 27 ? 1 : 0;
      turnFanOn(`Temperatur im Wohnzimmer: ${tempWZ}°C.`, speed);
    }

    // 2. Laufende Geschwindigkeitsanpassung (nur wenn der Ventilator bereits läuft)
    if (isFanOn) {
      const currentSpeed = getState(ID_FAN_SPEED)?.val;

      // Hochschalten auf Stufe 2, wenn die Temperatur die 27°C überschreitet und die Stufe noch nicht 2 ist
      if (temp >= 27 && oldTemp < 27 && currentSpeed !== 1) {
        setState(ID_FAN_SPEED, 1);
        notify(`𖣘 Ventilator-Stufe auf 2 erhöht (Temperatur: ${temp}°C).`);
      }
      // Runterschalten auf Stufe 1, wenn die Temperatur wieder unter 27°C fällt
      // Optmiert: Die Bedingung "temp >= 25" wurde entfernt, damit auch bei starken
      // Temperaturstürzen (z.B. 27.5°C auf 24.5°C) sauber auf Stufe 1 zurückgeregelt wird.
      else if (temp < 27 && oldTemp >= 27 && currentSpeed !== 0) {
        setState(ID_FAN_SPEED, 0);
        notify(`𖣘 Ventilator-Stufe auf 1 reduziert (Temperatur: ${temp}°C).`);
      }
    }
  }
});

// --- Trigger: Nachträgliches Einschalten (Wieder Online kommen) ---
// Falls der Ventilator zum Zeitpunkt des Temperaturauslösers offline war (z.B. stromlos),
// wird hier das Einschalten nachgeholt, sobald er wieder online meldet.
// "gt" = greater than (Wechsel von false auf true)
// @ts-expect-error
on({ id: ID_FAN_ONLINE, change: "gt" }, (obj) => {
  // Bedingung: Gerät ist jetzt online, Einschaltbefehl stand heute schon aus, Gerät ist aber noch aus.
  if (obj.state.val && einschaltenAktiv && !getState(ID_FAN_SWITCH)?.val) {
    const temp = getState(ID_TEMP_KACHELOFEN)?.val;

    // Ermittle aktuelle Jahreszeit und berechne die korrekte Geschwindigkeit (im Sommer ab 27°C Stufe 2)
    const isHeizmonat = isWinter();
    const speed = !isHeizmonat && temp >= 27 ? 1 : 0;

    // Einschaltvorgang nachholen
    turnFanOn("nachdem er wieder online war.", speed);
  }
});

// --- Schedule: Nächtlicher Reset ---
// Wird jeden Tag um 00:02 Uhr ausgeführt ("2 0 * * *")
schedule("2 0 * * *", () => {
  // Erlaubt das erneute Einschalten für den kommenden Tag
  einschaltenAktiv = false;

  // Aktualisiert zur Sicherheit auch direkt den globalen Heizperiode-Datenpunkt im System
  const heizperiode = isWinter();
  setState(ID_HEIZPERIODE, heizperiode, true);
});

// --- Trigger: Unerwartetes Ausschalten (Tuya 12-Stunden-Timer) ---
// Falls der Ventilator vor 23:00 Uhr von selbst ausgeht, prüfen wir, ob wir ihn reaktivieren müssen.
// "val: false" stellt sicher, dass wir nur auf das Ausschalten reagieren.
// @ts-expect-error
on({ id: ID_FAN_SWITCH, change: "ne", val: false }, () => {
  const hour = new Date().getHours();

  // Das geplante Ausschalten um 23 Uhr (und die Nachtruhe bis z.B. 6 Uhr) ignorieren wir.
  if (hour >= 23 || hour < 6) {
    return;
  }

  const temp = getState(ID_TEMP_KACHELOFEN)?.val;
  const isHeizmonat = isWinter();

  // Prüfen, ob die Bedingungen für einen Betrieb weiterhin erfüllt sind
  if (isHeizmonat && temp >= 23) {
    turnFanOn("nach automatischem 12h-Timeout reaktiviert.", 0);
  } else if (!isHeizmonat && temp >= 25) {
    const speed = temp >= 27 ? 1 : 0;
    turnFanOn("nach automatischem 12h-Timeout reaktiviert.", speed);
  }
});
