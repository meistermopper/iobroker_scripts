/* eslint-env es2022 */
/**
 * Name:   Pi-hole percent_blocked Extraktor
 * Zweck:  Dieses Skript überwacht die 'Summary'-Datenpunkte von zwei Pi-hole Instanzen,
 *         prüft und erstellt bei Bedarf die Ziel-Datenpunkte unter '0_userdata.0.pihole',
 *         extrahiert den Wert 'queries.percent_blocked', rundet ihn kaufmännisch auf
 *         eine ganze Zahl (ohne Nachkommastellen) und schreibt ihn in die Ziel-Datenpunkte.
 */

// Konfiguration der Instanzen: Quelle-Datenpunkt -> Ziel-Datenpunkt
const piholeConfigs = [
  {
    sourceDp: "pi-hole2.0.Summary",
    targetDp: "0_userdata.0.pihole.0.percent_blocked",
    name: "Pi-hole 0 Prozent Geblockt",
  },
  {
    sourceDp: "pi-hole2.1.Summary",
    targetDp: "0_userdata.0.pihole.1.percent_blocked",
    name: "Pi-hole 1 Prozent Geblockt",
  },
];

/**
 * Erstellt die Ziel-Datenpunkte unter 0_userdata.0, falls diese noch nicht existieren.
 *
 * @param {Function} callback - Wird ausgeführt, wenn alle Datenpunkte geprüft/angelegt wurden.
 */
function initDatapoints(callback) {
  let pending = piholeConfigs.length;

  piholeConfigs.forEach((config) => {
    // Prüfen, ob der Datenpunkt bereits existiert
    existsState(config.targetDp, (exists) => {
      if (!exists) {
        // Legt den Datenpunkt an, falls er fehlt
        createState(
          config.targetDp,
          0,
          {
            name: config.name,
            type: "number",
            role: "value.percentage",
            unit: "%",
            read: true,
            write: false,
            desc: "Extrahierter gerundeter Prozentwert der geblockten DNS-Anfragen",
          },
          () => {
            log(`Datenpunkt ${config.targetDp} wurde erfolgreich angelegt.`, "info");
            pending--;
            if (pending === 0 && typeof callback === "function") callback();
          },
        );
      } else {
        pending--;
        if (pending === 0 && typeof callback === "function") callback();
      }
    });
  });
}

/**
 * Parst das JSON eines Pi-hole Summary Datenpunkts und schreibt den gerundeten Wert.
 *
 * @param {Object} config - Das Konfigurationsobjekt für die jeweilige Pi-hole Instanz.
 */
function parseAndSavePiholeData(config) {
  // Zustand des Quell-Datenpunkts einlesen
  const sourceState = getState(config.sourceDp);

  if (
    !sourceState ||
    sourceState.val === null ||
    sourceState.val === undefined ||
    sourceState.val === ""
  ) {
    log(`Pi-hole Datenpunkt ${config.sourceDp} ist leer oder nicht vorhanden.`, "warn");
    return;
  }

  try {
    const rawData = sourceState.val;
    let jsonData;

    // Falls das JSON als String vorliegt, parsen wir es; falls bereits als Objekt, nutzen wir es direkt
    if (typeof rawData === "string") {
      jsonData = JSON.parse(rawData);
    } else if (typeof rawData === "object") {
      jsonData = rawData;
    }

    // Prüfung, ob der Pfad im JSON existiert
    if (jsonData && jsonData.queries && typeof jsonData.queries.percent_blocked !== "undefined") {
      // Prozentwert auslesen und auf ganze Zahl runden (z. B. 43.847... -> 44)
      const rawPercent = parseFloat(jsonData.queries.percent_blocked);
      const roundedPercent = Math.round(rawPercent);

      // Wert schreiben (ack = true). Durch ioBroker wird die Visu nur aktualisiert,
      // wenn sich die gerundete Ganzzahl auch tatsächlich geändert hat.
      setState(config.targetDp, roundedPercent, true);
    } else {
      log(`Attribut queries.percent_blocked in ${config.sourceDp} nicht gefunden.`, "warn");
    }
  } catch (e) {
    log(`Fehler beim Parsen von ${config.sourceDp}: ${e.message}`, "error");
  }
}

// Skript-Start: Datenpunkte prüfen/anlegen und initial ausführen
initDatapoints(() => {
  log("Alle Pi-hole Datenpunkte sind bereit. Verarbeite initiale Werte...", "info");
  piholeConfigs.forEach((config) => {
    parseAndSavePiholeData(config);

    // Überwachung (Trigger) auf Werteänderungen des Pi-hole Quell-Datenpunkts
    on({ id: config.sourceDp, change: "ne" }, () => {
      parseAndSavePiholeData(config);
    });
  });
});
