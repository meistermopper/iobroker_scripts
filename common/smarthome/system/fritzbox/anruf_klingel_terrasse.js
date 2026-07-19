/* eslint-env es2022 */
/**
 * Name:   Terrassen-Klingel (Anrufe & Haustür)
 * Zweck:  Meldet eingehende Anrufe oder Haustür-Klingeln auf der Terrasse (Google Mini via sayit.1) und benachrichtigt via Telegram & Gotify.
 */

// --- KONFIGURATION ---
// Datenpunkt des TR-064 Callmonitors: true bei eingehendem Anruf
const ID_RINGING = "tr-064.0.callmonitor.ringing";

// Datenpunkt für den aufgelösten Anrufernamen aus dem FRITZ!Box Telefonbuch
const ID_CALLER_NAME = "tr-064.0.callmonitor.inbound.callerName";

// Datenpunkt für die Rufnummer des Anrufers
const ID_CALLER_NUMBER = "tr-064.0.callmonitor.inbound.caller";

// Name und Rufnummer der Türsprechanlage in der FRITZ!Box
const DOORBELL_NAME = "Videoklingel";
const DOORBELL_NUMBER = "621";

// SayIt Datenpunkt für die Sprachausgabe auf dem Terrassen-Google-Speaker (Terrassen Google Mini)
const ID_SAYIT_TEXT = "sayit.1.tts.text";

// SayIt Datenpunkt zur Steuerung der Lautstärke
const ID_SAYIT_VOLUME = "sayit.1.tts.volume";

// Datenpunkte für die Steuerung der Hue-Lampen (Blinken bei Klingel)
const ID_LAMP_EI_COMMAND = "hue.0.Ei.command";
const ID_LAMP_KOMMODE_COMMAND = "hue.0.Kommode.command";

// --- LOGIK ---

// Globale Variable für die Blink-Timeouts, um Überlappungen zu vermeiden
let blinkTimeouts = [];

/**
 * Stoppt alle laufenden Timeouts des optischen Klingel-Signals.
 */
function clearBlinkTimeouts() {
  for (const t of blinkTimeouts) {
    clearTimeout(t);
  }
  blinkTimeouts = [];
}

/**
 * Steuert die Lampen "Ei" und "Kommode", damit diese mehrmals blinken.
 * Das Ei leuchtet dabei in grellem Blau. Anschließend werden die alten
 * Zustände beider Lampen wiederhergestellt.
 */
function triggerVisualAlert() {
  clearBlinkTimeouts();

  // Aktuelle Zustände sichern (on, level, ct, xy)
  const oldEi = {
    on: getState("hue.0.Ei.on")?.val,
    level: getState("hue.0.Ei.level")?.val,
    ct: getState("hue.0.Ei.ct")?.val,
    xy: getState("hue.0.Ei.xy")?.val,
  };

  const oldKommode = {
    on: getState("hue.0.Kommode.on")?.val,
    level: getState("hue.0.Kommode.level")?.val,
    ct: getState("hue.0.Kommode.ct")?.val,
    xy: getState("hue.0.Kommode.xy")?.val,
  };

  // CIE xy-Koordinaten für reines, grelles Blau
  const blueColor = [0.15, 0.05];

  // Definition der Blink-Befehle (transitiontime: 0 für schnellen Wechsel)
  const blinkOnEi = JSON.stringify({ on: true, level: 100, xy: blueColor, transitiontime: 0 });
  const blinkOffEi = JSON.stringify({ on: false, transitiontime: 0 });

  const blinkOnKommode = JSON.stringify({ on: true, level: 100, transitiontime: 0 });
  const blinkOffKommode = JSON.stringify({ on: false, transitiontime: 0 });

  // Ablauf: 3x blinken (An -> Aus -> An -> Aus -> An -> Aus)
  const steps = [
    { t: 0, ei: blinkOnEi, kommode: blinkOnKommode },
    { t: 800, ei: blinkOffEi, kommode: blinkOffKommode },
    { t: 1600, ei: blinkOnEi, kommode: blinkOnKommode },
    { t: 2400, ei: blinkOffEi, kommode: blinkOffKommode },
    { t: 3200, ei: blinkOnEi, kommode: blinkOnKommode },
    { t: 4000, ei: blinkOffEi, kommode: blinkOffKommode },
  ];

  for (const step of steps) {
    const timeoutId = setTimeout(() => {
      setState(ID_LAMP_EI_COMMAND, step.ei);
      setState(ID_LAMP_KOMMODE_COMMAND, step.kommode);
    }, step.t);
    blinkTimeouts.push(timeoutId);
  }

  // Nach dem letzten Aus (bei 4800ms) den gesicherten Zustand wiederherstellen
  const restoreTimeoutId = setTimeout(() => {
    // Restore Ei
    const restoreEi = { on: oldEi.on, transitiontime: 10 };
    if (oldEi.level !== null && oldEi.level !== undefined) restoreEi.level = oldEi.level;
    if (oldEi.ct !== null && oldEi.ct !== undefined) restoreEi.ct = oldEi.ct;
    if (oldEi.xy !== null && oldEi.xy !== undefined) {
      restoreEi.xy = typeof oldEi.xy === "string" ? oldEi.xy.split(",").map(Number) : oldEi.xy;
    }
    setState(ID_LAMP_EI_COMMAND, JSON.stringify(restoreEi));

    // Restore Kommode
    const restoreKommode = { on: oldKommode.on, transitiontime: 10 };
    if (oldKommode.level !== null && oldKommode.level !== undefined)
      restoreKommode.level = oldKommode.level;
    if (oldKommode.ct !== null && oldKommode.ct !== undefined) restoreKommode.ct = oldKommode.ct;
    if (oldKommode.xy !== null && oldKommode.xy !== undefined) {
      restoreKommode.xy =
        typeof oldKommode.xy === "string" ? oldKommode.xy.split(",").map(Number) : oldKommode.xy;
    }
    setState(ID_LAMP_KOMMODE_COMMAND, JSON.stringify(restoreKommode));
  }, 4800);

  blinkTimeouts.push(restoreTimeoutId);
}

// Trigger reagiert nur, wenn das Telefon anfängt zu klingeln (ringing wechselt auf true)
on({ id: ID_RINGING, val: true }, () => {
  // 1 Sekunde Verzögerung (Timeout), damit der TR-064 Adapter die Anruferdaten
  // aus der FRITZ!Box auslesen und die Datenpunkte befüllen kann, bevor wir sie abfragen.
  setTimeout(() => {
    // Aktuelle Werte des eingegangenen Anrufs abfragen
    const callerName = getState(ID_CALLER_NAME)?.val;
    const callerNumber = getState(ID_CALLER_NUMBER)?.val;

    // Rufnummer säubern und in String konvertieren, falls vorhanden
    const formattedNumber = callerNumber ? String(callerNumber).trim() : "";

    // Prüfung, ob es sich um die Türsprechanlage handelt (Name matches or number is 621 / **621)
    const isDoorbell =
      (callerName && String(callerName).trim() === DOORBELL_NAME) ||
      formattedNumber === DOORBELL_NUMBER ||
      formattedNumber === `**${DOORBELL_NUMBER}`;

    let speakText = "";
    let notifyText = "";
    let category = "Telefon";

    if (isDoorbell) {
      // Wenn es an der Haustür klingelt
      speakText = "Es klingelt an der Haustür.";
      notifyText = "Es klingelt an der Haustür!";
      category = "Haustür";
      triggerVisualAlert();
    } else {
      // Standard-Sprachausgabe für normale Anrufe (falls der Anrufer unbekannt ist)
      speakText = "Das Telefon klingelt";
      let isKnown = false;
      let who = "unbekannt";

      // Prüfung, ob ein gültiger Name im Telefonbuch der FRITZ!Box existiert:
      // Der Name darf nicht leer, "unknown", "Unbekannt" oder identisch mit der Rufnummer sein.
      if (
        callerName &&
        String(callerName).trim() !== "" &&
        String(callerName).trim() !== "unknown" &&
        String(callerName).trim() !== "Unbekannt" &&
        String(callerName).trim() !== formattedNumber
      ) {
        // Wenn ein Name gefunden wurde, diesen als Identität hinterlegen
        who = String(callerName).trim();
        isKnown = true; // Flag setzen, dass der Anrufer im Telefonbuch existiert
      } else if (formattedNumber) {
        // Falls kein Name existiert, aber eine Nummer übertragen wurde
        who = `Nummer ${formattedNumber}`;
      }

      // Wenn der Anrufer im Telefonbuch bekannt ist, passen wir den Ansagetext an
      if (isKnown) {
        speakText = `${who} ruft an.`;
      }
      notifyText = `Anruf von ${who}`;
    }

    // 1. Sprachausgabe auf der Terrasse via SayIt auslösen
    if (existsState(ID_SAYIT_TEXT)) {
      // Lautstärke vor der Ansage auf 50% anheben
      if (existsState(ID_SAYIT_VOLUME)) {
        setState(ID_SAYIT_VOLUME, 50);
      }

      // Ansage ausgeben
      setState(ID_SAYIT_TEXT, speakText);

      // Lautstärke nach 7 Sekunden (ausreichend Zeit für den Sprechtext) wieder auf 40% herabsetzen
      if (existsState(ID_SAYIT_VOLUME)) {
        setStateDelayed(ID_SAYIT_VOLUME, 40, 7000, false);
      }
    } else {
      console.warn(`[Terrassen-Klingel] SayIt-Datenpunkt ${ID_SAYIT_TEXT} existiert nicht.`);
    }

    // 2. Text-Benachrichtigungen an Telegram und Gotify via globale Funktion senden
    sendGlobalNotify(notifyText, category, 2);
  }, 1000);
});
