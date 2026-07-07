/**
 * Name:   Terrassen-Klingel (Anrufe)
 * Zweck:  Meldet eingehende Anrufe auf der Terrasse (Google Mini via sayit.1) und benachrichtigt via Telegram & Gotify.
 */

// --- KONFIGURATION ---
// Datenpunkt des TR-064 Callmonitors: true bei eingehendem Anruf
const ID_RINGING = "tr-064.0.callmonitor.ringing";

// Datenpunkt für den aufgelösten Anrufernamen aus dem FRITZ!Box Telefonbuch
const ID_CALLER_NAME = "tr-064.0.callmonitor.inbound.callerName";

// Datenpunkt für die Rufnummer des Anrufers
const ID_CALLER_NUMBER = "tr-064.0.callmonitor.inbound.caller";

// SayIt Datenpunkt für die Sprachausgabe auf dem Terrassen-Google-Speaker (Terrassen Google Mini)
const ID_SAYIT_TEXT = "sayit.1.tts.text";

// SayIt Datenpunkt zur Steuerung der Lautstärke
const ID_SAYIT_VOLUME = "sayit.1.tts.volume";

// --- LOGIK ---
// Trigger reagiert nur, wenn das Telefon anfängt zu klingeln (ringing wechselt auf true)
on({ id: ID_RINGING, val: true }, () => {
  // 1 Sekunde Verzögerung (Timeout), damit der TR-064 Adapter die Anruferdaten
  // aus der FRITZ!Box auslesen und die Datenpunkte befüllen kann, bevor wir sie abfragen.
  setTimeout(() => {
    // Aktuelle Werte des eingegangenen Anrufs abfragen
    const callerName = getState(ID_CALLER_NAME)?.val;
    const callerNumber = getState(ID_CALLER_NUMBER)?.val;

    // Standard-Sprachausgabe vorbereiten (wird angesagt, falls der Anrufer unbekannt ist)
    let speakText = "Das Telefon klingelt";
    let isKnown = false;
    let who = "unbekannt";

    // Rufnummer säubern und in String konvertieren, falls vorhanden
    const formattedNumber = callerNumber ? String(callerNumber).trim() : "";

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

    // Der Benachrichtigungstext für Telegram & Gotify soll detaillierter sein
    const notifyText = `Anruf von ${who}`;

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
    sendGlobalNotify(notifyText, "Telefon", 2);
  }, 1000);
});
