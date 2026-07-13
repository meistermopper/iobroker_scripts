/**
 * Name:   Solarprognose Master (Forecast.Solar)
 * Zweck:  Stündliche PV-Prognose über Forecast.Solar für heute & morgen.
 * Version: 2.0
 */

// --- 1. KONFIGURATION ---
// Geografische Koordinaten der PV-Anlage (Fallbacks, werden automatisch aus den ioBroker-Systemeinstellungen geladen)
let latitude = 51.1234; // Breitengrad
let longitude = 9.1234; // Längengrad

// Anlagendaten:
// - Dachneigung (TILT) in Grad: 0 = flach, 90 = senkrecht
// - Ausrichtung (AZIMUTH) in Grad: 0 = Süden, -90 = Osten, 90 = Westen, 180 = Norden
const TILT = 35;
const AZIMUTH = 90;

// Installierte Peak-Leistung der Anlage in kWp (z.B. 10.5 für 10.5 kWp)
const KWP = 7.1;

// Basis-Pfad für die Datenpunkte (ohne Punkt am Ende)
const baseRef = "0_userdata.0.Energie.PV.Prognose";

// Benachrichtigungen (Telegram & Gotify)
const SEND_TELEGRAM = true; // Auf true setzen, um Telegram-Nachrichten zu erhalten
const SEND_GOTIFY = true; // Auf true setzen, um Gotify-Nachrichten zu erhalten

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

  // API-Token für Forecast.Solar (optional)
  await createStateAsync(`${baseRef}.token_forecast_solar`, "", {
    name: "Forecast.Solar API-Token (optional)",
    type: "string",
    role: "text",
  });

  for (const day of days) {
    const path = `${baseRef}.${day}.`;

    await createStateAsync(`${path}Json`, "[]", {
      name: `JSON ${day}`,
      type: "string",
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

/**
 * Liest die geografischen Koordinaten aus den globalen ioBroker-Systemeinstellungen.
 */
async function loadSystemCoordinates() {
  try {
    const sysConfig = await getObjectAsync("system.config");
    if (sysConfig?.common) {
      if (typeof sysConfig.common.latitude === "number" && sysConfig.common.latitude !== 0) {
        latitude = sysConfig.common.latitude;
      }
      if (typeof sysConfig.common.longitude === "number" && sysConfig.common.longitude !== 0) {
        longitude = sysConfig.common.longitude;
      }
    }
  } catch (e) {
    console.warn(
      `[Solar-Prognose] Konnte System-Koordinaten nicht laden, nutze Fallbacks: ${e.message}`,
    );
  }
}

// Start der Initialisierung beim Skriptstart
async function startScript() {
  await initDPs();
  await loadSystemCoordinates();
}
startScript();

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
  //console.log("[Solar-Prognose] Starte API-Abfrage (Forecast.Solar)");

  let token = getState(`${baseRef}.token_forecast_solar`)?.val;
  if (token) {
    token = String(token).trim();
  }

  let url;
  if (token && token !== "" && token !== "null" && token !== "undefined") {
    url = `https://api.forecast.solar/${token}/estimate/${latitude}/${longitude}/${TILT}/${AZIMUTH}/${KWP}`;
  } else {
    // Falls kein Token vorhanden ist, nutzen wir die kostenfreie API
    url = `https://api.forecast.solar/estimate/${latitude}/${longitude}/${TILT}/${AZIMUTH}/${KWP}`;
  }

  httpGet(url, { timeout: 15000 }, (error, response) => {
    if (error) {
      console.warn(`[Solar-Prognose] API-Fehler: ${error}`);
      return;
    }

    if (!response) {
      console.warn("[Solar-Prognose] Keine Antwort vom API-Server erhalten.");
      return;
    }

    if (response.statusCode && response.statusCode !== 200) {
      const bodyPreview = response.data ? response.data.trim().substring(0, 150) : "Keine Daten";
      let hint = "";
      if (response.statusCode === 429) {
        hint =
          " (Tipp: Rate-Limit von Forecast.Solar überschritten. Bitte weniger Abfragen durchführen)";
      } else if (response.statusCode === 400) {
        hint = " (Tipp: Bitte prüfen Sie die Konfiguration der Koordinaten, Dachneigung oder kWp)";
      }
      console.warn(
        `[Solar-Prognose] HTTP-Statuscode ${response.statusCode} erhalten.${hint} Antwort-Vorschau: ${bodyPreview}...`,
      );
      return;
    }

    const responseData = response.data ? response.data.trim() : "";
    if (!responseData) {
      console.warn("[Solar-Prognose] API lieferte eine leere Antwort.");
      return;
    }

    if (
      responseData.startsWith("<!DOCTYPE") ||
      responseData.startsWith("<html") ||
      responseData.startsWith("<")
    ) {
      const bodyPreview = responseData.substring(0, 150);
      console.warn(
        `[Solar-Prognose] Server lieferte eine HTML-Fehlerseite statt JSON. Antwort-Vorschau: ${bodyPreview}...`,
      );
      return;
    }

    try {
      const obj = JSON.parse(responseData);
      if (obj.message && obj.message.type === "error") {
        console.warn(
          `[Solar-Prognose] API lieferte einen Fehler: ${obj.message.text} (Code: ${obj.message.code})`,
        );
        return;
      }

      if (!obj?.result?.watts) {
        console.warn(
          `[Solar-Prognose] API lieferte keine gültigen Prognosedaten. Response: ${responseData}`,
        );
        return;
      }

      // Forecast.Solar Datenstruktur in das alte Format übersetzen:
      // data[timestampInSeconds] = [leistung_watt, kumulierter_ertrag_wh]
      const data = {};
      for (const [dateTimeStr, watt] of Object.entries(obj.result.watts)) {
        const normalizedStr = dateTimeStr.replace(" ", "T");
        const tsMs = new Date(normalizedStr).getTime();
        if (!Number.isNaN(tsMs)) {
          const tsSec = Math.floor(tsMs / 1000);
          const wh = obj.result.watt_hours ? obj.result.watt_hours[dateTimeStr] || 0 : 0;
          data[tsSec] = [watt, wh];
        }
      }

      // Gesamte Rohdaten speichern
      setState(`${baseRef}.Json`, JSON.stringify(data), true);

      const splitData = formatAndSplitData(data);

      // Verarbeitung nur für heute und morgen
      processDayData("heute", splitData.heute);
      processDayData("morgen", splitData.morgen);

      // Benachrichtigungen senden (Telegram & Gotify)
      if (SEND_TELEGRAM || SEND_GOTIFY) {
        setTimeout(() => {
          try {
            const peakHeute = getState(`${baseRef}.heute.leistung`)?.val || 0;
            const ertragHeute = getState(`${baseRef}.heute.gesamt`)?.val || 0;
            const peakMorgen = getState(`${baseRef}.morgen.leistung`)?.val || 0;
            const ertragMorgen = getState(`${baseRef}.morgen.gesamt`)?.val || 0;

            const textHtml =
              `<b>PV-Prognose Update (Forecast.Solar)</b>\n\n` +
              `• <b>Heute:</b> ${ertragHeute} Wh (Peak: ${peakHeute} W)\n` +
              `• <b>Morgen:</b> ${ertragMorgen} Wh (Peak: ${peakMorgen} W)`;

            const textPlain =
              `PV-Prognose Update (Forecast.Solar)\n\n` +
              `- Heute: ${ertragHeute} Wh (Peak: ${peakHeute} W)\n` +
              `- Morgen: ${ertragMorgen} Wh (Peak: ${peakMorgen} W)`;

            sendTelegramMessage(textHtml);
            sendGotifyMessage("PV-Prognose Update", textPlain);
          } catch (err) {
            console.error(
              `[Solar-Prognose Fail] Fehler beim Erstellen der Benachrichtigung: ${err.message}`,
            );
          }
        }, 1000);
      }
    } catch (e) {
      console.error(`[Solar-Prognose Fail] Fehler beim Parsen der API-Antwort: ${e.message}`);
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

/**
 * Sendet eine Nachricht über den Telegram-Adapter.
 */
function sendTelegramMessage(msg) {
  if (!SEND_TELEGRAM) return;
  sendTo("telegram", "send", {
    text: msg,
    parse_mode: "HTML",
  });
}

/**
 * Sendet eine Nachricht an den Gotify-Server mittels httpPost().
 */
function sendGotifyMessage(title, message) {
  if (!SEND_GOTIFY) return;

  const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker")?.val;
  if (!gotifyToken) {
    console.error(
      "[Solar-Prognose Fail] Gotify-Token konnte nicht aus '0_userdata.0.gotifytoken.iobroker' gelesen werden.",
    );
    return;
  }

  const url = `https://mygotify.meistermopper.de/message?token=${gotifyToken}`;
  const payload = {
    title: title,
    message: message,
    priority: 5,
  };

  httpPost(
    url,
    JSON.stringify(payload),
    { headers: { "Content-Type": "application/json" } },
    (error) => {
      if (error) {
        console.error(`[Solar-Prognose Fail] Gotify Fehler: ${error}`);
      }
    },
  );
}
