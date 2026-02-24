/**
 * =============================================================================
 * SKRIPT: SOLAR-PROGNOSE MASTER (VERSION 1.4)
 * =============================================================================
 * ZWECK: Stündliche PV-Prognose von solarprognose.de
 * OPTIMIERT: 
 * - Automatisches Anlegen der Datenpunkte in 0_userdata.0.
 * - Fehlertolerant bei fehlenden Daten für "übermorgen".
 * - Unterdrückung von Warnmeldungen bei der Initialisierung.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const API_TOKEN = '72206e8f60f98f2a22101ea20fd0c999';
const INVERTER_ID = '4511';
const url = `http://www.solarprognose.de/web/solarprediction/api/v1?_format=json&access-token=${API_TOKEN}&item=inverter&id=${INVERTER_ID}&type=hourly`;

// WICHTIG: Kein Punkt am Ende!
const baseRef = '0_userdata.0.Energie.PV.Prognose'; 

// --- 2. INITIALISIERUNG ---

/**
 * Erstellt die Datenstruktur. Wir nutzen hier die Standard-Funktion,
 * stellen aber sicher, dass keine Fehler geworfen werden, wenn Punkte noch im Werden sind.
 */
async function initDPs() {
    const days = ['heute', 'morgen', 'uebermorgen'];
    
    // Basis-Ordner und JSON-Punkt
    await createStateAsync(baseRef + '.Json', "", { name: 'Rohdaten JSON', type: 'string', role: 'json' });

    for (const day of days) {
        const path = baseRef + '.' + day + '.'; 
        
        await createStateAsync(path + 'Json', [], { name: `JSON ${day}`, type: 'array', role: 'json' });
        await createStateAsync(path + 'gesamt', 0, { name: `Ertrag ${day}`, type: 'number', unit: 'Wh' });
        await createStateAsync(path + 'uhrzeit', "", { name: `Peak Zeit ${day}`, type: 'string' });
        await createStateAsync(path + 'leistung', 0, { name: `Peak Watt ${day}`, type: 'number', unit: 'W' });
    }
    console.log("[Solar-Prognose] Datenstruktur unter 0_userdata.0 wurde geprüft/erstellt.");
}

// Start der Prüfung
initDPs();

// --- 3. ZEITPLAN ---
schedule('4 8,10,12,14,16,18,20 * * *', () => {
    fetchSolarData();
});

// --- 4. DATENVERARBEITUNG ---

function fetchSolarData() {
    console.log("[Solar-Prognose] Starte API-Abfrage...");

    httpGet(url, { timeout: 15000 }, (error, response) => {
        if (error) {
            console.warn('[Solar-Prognose] API-Fehler: ' + error);
            return;
        }
        
        try {
            const obj = JSON.parse(response.data);
            if (!obj || !obj.data || (obj.status && obj.status !== 0)) {
                console.warn('[Solar-Prognose] API liefert keine gültigen Daten.');
                return;
            }

            // Rohdaten speichern (true am Ende unterdrückt "not found" Fehler beim ersten Mal)
            setState(baseRef + '.Json', JSON.stringify(obj.data), true);

            const splitData = formatAndSplitData(obj.data);

            // Verarbeitung der Tage
            processDayData('heute', splitData.heute);
            processDayData('morgen', splitData.morgen);
            processDayData('uebermorgen', splitData.uebermorgen);

        } catch (e) {
            console.error('[Solar-Prognose] Fehler beim Parsen: ' + e);
        }
    });
}

function processDayData(dayName, dataArray) {
    // Falls für einen Tag (meist übermorgen) keine Daten da sind -> Abbruch ohne Fehler
    if (!dataArray || dataArray.length === 0) {
        console.log(`[Solar-Prognose] Hinweis: Keine Daten für '${dayName}' geliefert.`);
        return;
    }

    const path = baseRef + '.' + dayName + '.';
    
    // Die Berechnung von Peak und Gesamt
    let maxWatt = 0;
    let peakTime = '--:--';

    dataArray.forEach(entry => {
        const time = entry[0];
        const watt = entry[1];
        if (typeof watt === 'number' && watt > maxWatt) {
            maxWatt = watt;
            peakTime = time;
        }
    });

    const lastEntry = dataArray[dataArray.length - 1];
    const gesamtWh = (lastEntry && lastEntry.length >= 3) ? lastEntry[2] : 0;

    // SCHREIBEN DER WERTE
    // Das 'true' als dritter Parameter verhindert Warnungen, falls das Objekt gerade erst erstellt wurde.
    if (existsState(path + 'Json'))     setState(path + 'Json', dataArray, true);
    if (existsState(path + 'gesamt'))   setState(path + 'gesamt', gesamtWh, true);
    if (existsState(path + 'uhrzeit'))  setState(path + 'uhrzeit', peakTime, true);
    if (existsState(path + 'leistung')) setState(path + 'leistung', maxWatt, true);

    console.log(`[Solar-Prognose] ${dayName.toUpperCase()}: Peak ${maxWatt}W um ${peakTime} Uhr.`);
}

function formatAndSplitData(data) {
    const MS_IN_DAY = 86400000;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const result = { heute: [], morgen: [], uebermorgen: [] };

    for (const [timestamp, values] of Object.entries(data)) {
        const ts = Number(timestamp) * 1000;
        const date = new Date(ts);
        const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const entry = [timeStr, ...values]; 

        if (ts >= startOfToday && ts < startOfToday + MS_IN_DAY) {
            result.heute.push(entry);
        } else if (ts >= startOfToday + MS_IN_DAY && ts < startOfToday + (MS_IN_DAY * 2)) {
            result.morgen.push(entry);
        } else if (ts >= startOfToday + (MS_IN_DAY * 2)) {
            result.uebermorgen.push(entry);
        }
    }
    return result;
}

// Erster Start nach 10 Sekunden (gibt dem System Zeit, die neuen DPs zu registrieren)
setTimeout(fetchSolarData, 10000);