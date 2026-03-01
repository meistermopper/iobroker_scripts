/**
 * =============================================================================
 * SKRIPT: TROCKNER-ÜBERWACHUNG (V2.8)
 * =============================================================================
 * ZWECK: Überwachung von Start/Ende und Energie-Statistik.
 * ÄNDERUNG: SayIt Sprachausgabe auf "Der Trockner ist fertig." gekürzt.
 * Teständerung über VSCode 
* =============================================================================
 */

// --- 1. KONFIGURATION ---
const ID_POWER_T  = 'alias.0.waschen.trocknen.ENERGY_Power';  // Aktuelle Leistung
const ID_ENERGY_T = 'alias.0.waschen.trocknen.ENERGY_Total';  // Gesamt-Zähler

const PATH_STAT_T = '0_userdata.0.Energie.Statistik';
const PATH_PRIC_T = '0_userdata.0.Energie.Strompreise';

const ID_PRICE_T  = `${PATH_PRIC_T}.akt_Preis`;
const ID_TOTAL_T  = `${PATH_STAT_T}.Trockner_Tag`;
const ID_GOTIFY_T = '0_userdata.0.gotifytoken.iobroker';

// VIS Datenpunkt für die Status-Anzeige
const ID_VIS_T    = '0_userdata.0.Haushalt.trocknen';

// Schwellenwerte für den Trockner
const START_WATT_T = 5;     
const END_WATT_T   = 2;      
const END_DELAY_T  = 300000; // 5 Minuten Puffer (Knitterschutz-Sicherheit)

// Interne Variablen
let isRunningT = false;
let startTimeT = null;
let startEnergyT = 0;
let timerEndT = null;

// --- 2. INITIALISIERUNG ---
async function initTrocknerSystem() {
    if (!existsState(ID_TOTAL_T)) {
        await createStateAsync(ID_TOTAL_T, 0, { 
            type: 'number', name: 'Trockner Verbrauch Heute', unit: 'kWh', role: 'value' 
        });
    }
    if (!existsState(ID_VIS_T)) {
        await createStateAsync(ID_VIS_T, false, { 
            type: 'boolean', name: 'Trockner läuft (VIS)', role: 'indicator.working' 
        });
    }
    console.log("[Trockner] Initialisierung v2.8 abgeschlossen.");
}
initTrocknerSystem();

// --- 3. KOMMUNIKATIONS-ZENTRALE ---

function dryNotify(text) {
    // 1. Telegram
    sendTo('telegram', { text: text });

    // 2. Gotify
    const token = getState(ID_GOTIFY_T).val;
    if (token) {
        exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=Haushalt" -F "message=${text}" -F "priority=5"`);
    }

    // 3. SayIt (Gekürzte Sprachausgabe)
    if (compareTime('08:00', '20:00', 'between')) {
        const voiceMsg = "Der Trockner ist fertig.";
        sendTo("sayit", "say", { text: voiceMsg });
    }
    
    console.log("[Trockner] Benachrichtigungen versendet.");
}

// --- 4. TAGES-RESET ---
schedule("0 0 * * *", () => {
    setState(ID_TOTAL_T, 0, true);
    console.log("[Trockner] Statistik-Reset.");
});

// --- 5. HAUPTLOGIK ---

on({ id: ID_POWER_T, change: 'ne' }, (obj) => {
    const watt = obj.state.val;

    if (watt > START_WATT_T && !isRunningT) {
        if (timerEndT) { clearTimeout(timerEndT); timerEndT = null; }
        
        isRunningT = true;
        startTimeT = Date.now();
        startEnergyT = getState(ID_ENERGY_T).val; 
        
        setState(ID_VIS_T, true, true);
        console.log("[Trockner] Trocknung gestartet.");
    }

    if (watt < END_WATT_T && isRunningT && !timerEndT) {
        timerEndT = setTimeout(processFinishT, END_DELAY_T);
    }
});

function processFinishT() {
    const endEnergy = getState(ID_ENERGY_T).val;
    const priceKwh = getState(ID_PRICE_T).val || 0.30;
    
    const diffEnergy = Math.max(0, endEnergy - startEnergyT);
    const totalCost = diffEnergy * priceKwh;
    
    const durationMs = Date.now() - startTimeT - END_DELAY_T;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const timeStr = hours + ":" + (minutes < 10 ? '0' + minutes : minutes) + " Std.";

    const currentTotalT = getState(ID_TOTAL_T).val || 0;
    const newTotalT = currentTotalT + diffEnergy;
    setState(ID_TOTAL_T, newTotalT, true);

    const msg = `☀️💨 Der Trockner ist fertig. Dauer: ${timeStr}. ` +
                `Verbrauch: ${diffEnergy.toFixed(2)} kWh (${totalCost.toFixed(2)} €). ` +
                `Heute gesamt: ${newTotalT.toFixed(2)} kWh.`;

    dryNotify(msg);
    
    setState(ID_VIS_T, false, true);
    isRunningT = false;
    timerEndT = null;
}