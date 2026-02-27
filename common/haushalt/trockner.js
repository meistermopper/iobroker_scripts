/**
 * =============================================================================
 * SKRIPT: TROCKNER-ÜBERWACHUNG (V2.4)
 * =============================================================================
 * FIX: Nutzt eigenständige Statistik im Ordner 'Statistik'.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const ID_POWER_T  = 'alias.0.geraete.trockner.power';
const ID_ENERGY_T = 'alias.0.geraete.trockner.energy';

const PATH_STAT_T = '0_userdata.0.Energie.Statistik';
const PATH_PRIC_T = '0_userdata.0.Energie.Strompreise';

const ID_PRICE_T  = `${PATH_PRIC_T}.akt_Preis`;
const ID_TOTAL_T  = `${PATH_STAT_T}.Trockner_Tag`;

const START_WATT_T = 5;
const END_WATT_T   = 2;
const END_DELAY_T  = 300000; // 5 Minuten Puffer für Trockner

let isRunningT = false;
let startTimeT = null;
let startEnergyT = 0;
let timerEndT = null;

// --- 2. INITIALISIERUNG ---
async function initTrocknerStatistik() {
    if (!existsState(ID_TOTAL_T)) {
        await createStateAsync(ID_TOTAL_T, 0, { 
            type: 'number', 
            name: 'Trockner Verbrauch Heute (Skript-intern)', 
            unit: 'kWh', 
            role: 'value' 
        });
    }
}
initTrocknerStatistik();

// --- 3. TAGES-RESET ---
schedule("0 0 * * *", () => {
    setState(ID_TOTAL_T, 0, true);
    console.log("[Trockner] Statistik für den neuen Tag zurückgesetzt.");
});

// --- 4. HAUPTLOGIK ---

on({ id: ID_POWER_T, change: 'ne' }, (obj) => {
    const watt = obj.state.val;

    if (watt > START_WATT_T && !isRunningT) {
        if (timerEndT) { clearTimeout(timerEndT); timerEndT = null; }
        
        isRunningT = true;
        startTimeT = Date.now();
        startEnergyT = getState(ID_ENERGY_T).val;
        
        console.log("[Trockner] Trocknung gestartet bei " + startEnergyT + " kWh.");
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

    sendTo('telegram', { text: msg });
    console.log("[Trockner] " + msg);
    
    isRunningT = false;
    timerEndT = null;
}