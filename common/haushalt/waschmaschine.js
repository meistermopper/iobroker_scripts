/**
 * =============================================================================
 * SKRIPT: WASCHMASCHINEN-ÜBERWACHUNG (V2.8)
 * =============================================================================
 * ZWECK: Überwachung von Start/Ende und Energie-Statistik.
 * ÄNDERUNG: SayIt Sprachausgabe auf "Die Waschmaschine ist fertig." gekürzt.
 * DATENPUNKTE: Nutzt die korrekten Aliase und den exklusiven Statistik-Ordner.
 * =============================================================================
 */

// --- 1. KONFIGURATION (PFADE AN DEIN SYSTEM ANGEPASST) ---
const ID_POWER  = 'alias.0.waschen.wasch.ENERGY_Power';  // Aktuelle Leistung (Watt)
const ID_ENERGY = 'alias.0.waschen.wasch.ENERGY_Total';  // Gesamt-Zähler (kWh)

const PATH_STAT = '0_userdata.0.Energie.Statistik';
const PATH_PRIC = '0_userdata.0.Energie.Strompreise';

const ID_PRICE  = `${PATH_PRIC}.akt_Preis`;        // Dein Strompreis
const ID_TOTAL  = `${PATH_STAT}.Waschmaschine_Tag`; // Exklusiver Statistik-Datenpunkt
const ID_GOTIFY = '0_userdata.0.gotifytoken.iobroker'; // Pfad zum Gotify-Token

// VIS Datenpunkt für die Status-Anzeige (An/Aus)
const ID_VIS    = '0_userdata.0.Haushalt.waschen'; 

// Schwellenwerte für die Erkennung
const START_WATT = 10;     // Start-Schwelle in Watt
const END_WATT   = 3;      // Ende-Schwelle (Standby)
const END_DELAY  = 120000; // 2 Minuten Pufferzeit gegen Spülpausen

// Interne Variablen (Gedächtnis)
let isRunning = false;
let startTime = null;
let startEnergy = 0;
let timerEnd = null;

// --- 2. INITIALISIERUNG ---
async function initWaschSystem() {
    if (!existsState(ID_TOTAL)) {
        await createStateAsync(ID_TOTAL, 0, { 
            type: 'number', name: 'Waschmaschine Verbrauch Heute', unit: 'kWh', role: 'value' 
        });
    }
    if (!existsState(ID_VIS)) {
        await createStateAsync(ID_VIS, false, { 
            type: 'boolean', name: 'Waschmaschine läuft (VIS)', role: 'indicator.working' 
        });
    }
    console.log("[Waschmaschine] Initialisierung v2.8 abgeschlossen.");
}
initWaschSystem();

// --- 3. KOMMUNIKATIONS-ZENTRALE ---

/**
 * Versendet Meldungen über verschiedene Kanäle.
 * @param {string} text - Der detaillierte Text für Telegram/Gotify.
 */
function washNotify(text) {
    // 1. Telegram (Detailliert)
    sendTo('telegram', { text: text });

    // 2. Gotify (Detailliert via curl)
    const token = getState(ID_GOTIFY).val;
    if (token) {
        exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=Haushalt" -F "message=${text}" -F "priority=5"`);
    }

    // 3. SayIt (Gekürzte Sprachausgabe nur zwischen 08:00 und 20:00 Uhr)
    if (compareTime('08:00', '20:00', 'between')) {
        const voiceMsg = "Die Waschmaschine ist fertig.";
        sendTo("sayit", "say", { text: voiceMsg });
    }
    
    console.log("[Waschmaschine] Benachrichtigungen versendet.");
}

// --- 4. TAGES-RESET ---
schedule("0 0 * * *", () => {
    setState(ID_TOTAL, 0, true);
    console.log("[Waschmaschine] Statistik-Reset für neuen Tag.");
});

// --- 5. HAUPTLOGIK ---

on({ id: ID_POWER, change: 'ne' }, (obj) => {
    const watt = obj.state.val;

    // START-PHASE: Erkennt den echten Anlauf der Maschine
    if (watt > START_WATT && !isRunning) {
        if (timerEnd) { clearTimeout(timerEnd); timerEnd = null; }
        
        isRunning = true;
        startTime = Date.now();
        startEnergy = getState(ID_ENERGY).val; // Zählerstand beim Start fixieren
        
        setState(ID_VIS, true, true); // VIS-Anzeige auf "An"
        console.log("[Waschmaschine] Waschgang gestartet.");
    }

    // ENDE-PHASE: Startet den Verzögerungs-Timer
    if (watt < END_WATT && isRunning && !timerEnd) {
        timerEnd = setTimeout(processFinish, END_DELAY);
    }
});

function processFinish() {
    const endEnergy = getState(ID_ENERGY).val;
    const priceKwh = getState(ID_PRICE).val || 0.30;
    
    // Berechnung der Verbrauchsdaten
    const diffEnergy = Math.max(0, endEnergy - startEnergy);
    const totalCost = diffEnergy * priceKwh;
    
    // Zeitberechnung (abzüglich der Pufferzeit)
    const durationMs = Date.now() - startTime - END_DELAY;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const timeStr = hours + ":" + (minutes < 10 ? '0' + minutes : minutes) + " Std.";

    // Tagesstatistik aktualisieren
    const currentTotal = getState(ID_TOTAL).val || 0;
    const newTotal = currentTotal + diffEnergy;
    setState(ID_TOTAL, newTotal, true);

    const msg = `🧺 Die Waschmaschine ist fertig. Dauer: ${timeStr}. ` +
                `Verbrauch: ${diffEnergy.toFixed(2)} kWh (${totalCost.toFixed(2)} €). ` +
                `Heute gesamt: ${newTotal.toFixed(2)} kWh.`;

    washNotify(msg);
    
    setState(ID_VIS, false, true); // VIS-Anzeige auf "Aus"
    isRunning = false;
    timerEnd = null;
}