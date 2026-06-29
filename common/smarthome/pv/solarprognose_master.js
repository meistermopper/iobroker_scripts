/**
 * =============================================================================
 * SKRIPT: SOLAR-PROGNOSE MASTER (VERSION 1.6)
 * =============================================================================
 * ZWECK: Stündliche PV-Prognose von solarprognose.de für heute & morgen.
 * OPTIMIERT:
 * - Reduziert auf 2 Tage (übermorgen entfernt, um Logs sauber zu halten).
 * - Automatisches Anlegen der Datenpunkte in 0_userdata.0.
 * - Unterdrückung von Warnmeldungen bei der Initialisierung.
 * - Logs bereinigt
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const API_TOKEN = "72206e8f60f98f2a22101ea20fd0c999";
const INVERTER_ID = "4511";
const url = `http://www.solarprognose.de/web/solarprediction/api/v1?_format=json&access-token=${API_TOKEN}&item=inverter&id=${INVERTER_ID}&type=hourly`;

// Basis-Pfad für die Datenpunkte (ohne Punkt am Ende)
const baseRef = "0_userdata.0.Energie.PV.Prognose";

// --- 2. INITIALISIERUNG ---

/**
 * Erstellt die Datenstruktur in 0_userdata.0.
 * Wir beschränken uns nun auf heute und morgen.
 */
async function initDPs() {
  const days = ["heute", "morgen"]; // 'uebermorgen' entfernt

  // Basis-JSON für die Rohdaten
  await createStateAsync(`${baseRef}.Json`, "", {
    name: "Rohdaten JSON",
    type: "string",
    role: "json",
  });

  for (const day of days) {
    const path = `${baseRef}.${day}.`;

    await createStateAsync(`${path}Json`, [], {
      name: `JSON ${day}`,
      type: "array",
      role: "json",
    });
    await createStateAsync(`${path}gesamt`, 0, {
      name: `Ertrag ${day}`,
      type: "number",
      unit: "Wh",
    });
    await createStateAsync(`${path}uhrzeit`, "", {
      name: `Peak Zeit ${day}`,
      type: "string",
    });
    await createStateAsync(`${path}leistung`, 0, {
      name: `Peak Watt ${day}`,
      type: "number",
      unit: "W",
    });
  }
  //console.log("[Solar-Prognose] Datenstruktur (heute/morgen) wurde geprüft/erstellt");
}

// Start der Initialisierung beim Skriptstart
initDPs();

// --- 3. ZEITPLAN ---
// Abfrage alle 2 Stunden ab 08:04 Uhr
schedule("4 8,10,12,14,16,18,20 * * *", () => {
  fetchSolarData();
});

// --- 4. DATENVERARBEITUNG ---

/**
 * Holt die Daten von der API und verteilt sie auf die Tage.
 */
function fetchSolarData() {
  //console.log("[Solar-Prognose] Starte API-Abfrage");

  httpGet(url, { timeout: 15000 }, (error, response) => {
    if (error) {
      console.warn(`Solar-Prognose: API-Fehler - ${error}`);
      return;
    }

    try {
      const obj = JSON.parse(response.data);
      if (!obj?.data || (obj.status && obj.status !== 0)) {
        console.warn("Solar-Prognose: API liefert keine gültigen Daten");
        return;
      }

      // Gesamte Rohdaten speichern
      setState(`${baseRef}.Json`, JSON.stringify(obj.data), true);

      const splitData = formatAndSplitData(obj.data);

      // Verarbeitung nur für heute und morgen
      processDayData("heute", splitData.heute);
      processDayData("morgen", splitData.morgen);
    } catch (e) {
      console.error(`Solar-Prognose: Fehler beim Parsen - ${e}`);
    }
  });
}

/**
 * Berechnet Peak-Werte und Ertrag für einen Tag.
 */
function processDayData(dayName, dataArray) {
  if (!dataArray || dataArray.length === 0) {
    console.log(`Solar-Prognose: Hinweis, keine Daten für '${dayName}' geliefert`);
    return;
  }

  const path = `${baseRef}.${dayName}.`;

  let maxWatt = 0;
  let peakTime = "--:--";

  // Suche nach der höchsten Leistung im Stunden-Array
  dataArray.forEach((entry) => {
    const time = entry[0];
    const watt = entry[1];
    if (typeof watt === "number" && watt > maxWatt) {
      maxWatt = watt;
      peakTime = time;
    }
  });

  // Der letzte Eintrag im Array enthält bei dieser API den kumulierten Tagesertrag
  const lastEntry = dataArray[dataArray.length - 1];
  const gesamtWh = lastEntry && lastEntry.length >= 3 ? lastEntry[2] : 0;

  // Werte in ioBroker schreiben
  if (existsState(`${path}Json`)) setState(`${path}Json`, dataArray, true);
  if (existsState(`${path}gesamt`)) setState(`${path}gesamt`, gesamtWh, true);
  if (existsState(`${path}uhrzeit`)) setState(`${path}uhrzeit`, peakTime, true);
  if (existsState(`${path}leistung`)) setState(`${path}leistung`, maxWatt, true);

  //console.log(`[Solar-Prognose] ${dayName.toUpperCase()}: Peak ${maxWatt}W um ${peakTime} Uhr`);
}

/**
 * Trennt die flache Liste der API in heute und morgen auf.
 */
function formatAndSplitData(data) {
  const MS_IN_DAY = 86400000;
  const now = new Date();
  // Zeitstempel von heute 00:00:00 Uhr
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const result = { heute: [], morgen: [] };

  for (const [timestamp, values] of Object.entries(data)) {
    const ts = Number(timestamp) * 1000;
    const date = new Date(ts);
    const timeStr = date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const entry = [timeStr, ...values];

    // Einsortierung in heute oder morgen
    if (ts >= startOfToday && ts < startOfToday + MS_IN_DAY) {
      result.heute.push(entry);
    } else if (ts >= startOfToday + MS_IN_DAY && ts < startOfToday + MS_IN_DAY * 2) {
      result.morgen.push(entry);
    }
  }
  return result;
}

// Erster Start verzögert (gibt ioBroker Zeit zum Registrieren der Datenpunkte)
setTimeout(fetchSolarData, 10000);
