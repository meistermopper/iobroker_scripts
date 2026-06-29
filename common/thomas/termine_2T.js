/**
 * Name:   Send iCal Appointments (Optimized)
 * Zweck:  Anstehende Termine via Telegram senden
 */
const CONFIG = {
  anzahlTage: 2,
  user: "Thomas",
  idTable: "ical.1.data.table",
};

async function termineSenden() {
  const table = getState(CONFIG.idTable)?.val;
  if (!table || !Array.isArray(table)) {
    console.warn("iCal Tabelle ist leer oder nicht verfügbar.");
    return;
  }

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  let msg = "";

  table.forEach((termin) => {
    // Wir nehmen das Datum aus termin._date (ISO-Format) für den Vergleich
    const eventTag = new Date(termin._date);
    eventTag.setHours(0, 0, 0, 0);

    // Differenz berechnen (Millisekunden -> Tage)
    const diffTage = Math.round((eventTag - heute) / (24 * 60 * 60 * 1000));

    // Nur Termine von Heute (0) bis zum konfigurierten Zeitraum (z.B. 2)
    if (diffTage >= 0 && diffTage <= CONFIG.anzahlTage) {
      let prefix = "";
      let zeitStr = "";

      // 1. Prefix bestimmen
      if (diffTage === 0) prefix = "Heute:  ";
      else if (diffTage === 1) prefix = "Morgen: ";
      else {
        // Falls mehr als 2 Tage: Datum aus dem 'date' String extrahieren (die ersten 10 Zeichen)
        prefix =
          termin.date.length >= 10
            ? termin.date.substring(0, 10) + ": "
            : "Später: ";
      }

      // 2. Uhrzeit extrahieren, falls vorhanden und NICHT ganztägig
      // In deinen Daten steht bei Terminen mit Zeit z.B. "26.01.2026 11:00-12:00"
      if (!termin._allDay) {
        const zeitMatch = termin.date.match(/(\d{2}:\d{2})/);
        if (zeitMatch) {
          zeitStr = ` [${zeitMatch[1]} Uhr]`;
        }
      }

      msg += `${prefix}${termin.event}${zeitStr}\n`;
    }
  });

  if (msg) {
    // Wir nutzen <pre> für die Tabellen-Optik (Schreibmaschinenschrift)
    const finalMsg = `<b>📅 Anstehende Termine:</b>\n<pre>${msg}</pre>`;
    sendTo("telegram", {
      user: CONFIG.user,
      text: finalMsg,
      parse_mode: "HTML",
    });
  } else {
    //console.log(`Keine Termine für die nächsten ${CONFIG.anzahlTage} Tage gefunden.`);
  }
}

// Zeitplan: Jeden Morgen um 05:00 Uhr
schedule("0 5 * * *", async () => {
  await termineSenden();
  //console.log('+++ iCal: Termine geprüft und gesendet +++');
});

// Optional: Sofort-Start beim Speichern des Skripts zum Testen
// termineSenden();
