/**
 * =============================================================================
 * SKRIPT: WASCHMASCHINEN-ÜBERWACHUNG (V2.4)
 * =============================================================================
 * ZWECK: Überwachung von Start/Ende und Energie-Statistik.
 * NEU: Eigener Statistik-Ordner zur Vermeidung von Konflikten mit Tageswerten.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const ID_POWER  = 'alias.0.geraete.waschmaschine.power';  // Watt-Leistung
const ID_ENERGY = 'alias.0.geraete.waschmaschine.energy'; // Gesamt-Zähler (kWh)

// Neue Pfade für Deine Statistik und Preise
const PATH_STAT = '0_userdata.0.Energie.Statistik';
const PATH_PRIC = '0_userdata.0.Energie.Strompreise';

const ID_PRICE  = `${PATH_PRIC}.akt_Preis`;        // Dein Strompreis
const ID_TOTAL  = `${PATH_STAT}.Waschmaschine_Tag`; // Der neue, exklusive Datenpunkt

// Schwellenwerte
const START_WATT = 10;     // Start bei > 10W
const END_WATT   = 3;      // Ende bei < 3W
const END_DELAY  = 120000; // 2 Minuten Pufferzeit

// Interne Variablen
let isRunning = false;
let startTime = null;
let startEnergy = 0;
let timerEnd = null;

// --- 2. INITIALISIERUNG ---
/**
 * Erstellt den neuen Statistik-Ordner und den Datenpunkt, falls nicht vorhanden.
 */
async function initWaschStatistik() {
    if (!existsState(ID_TOTAL)) {
        await createStateAsync(ID_TOTAL, 0, { 
            type: 'number', 
            name: 'Waschmaschine Verbrauch Heute (Skript-intern)', 
            unit: 'kWh', 
            role: 'value' 
        });
    }
    console.log("[Waschmaschine] Statistik-Datenpunkt wurde geprüft/erstellt.");
}
initWaschStatistik();

// --- 3. TAGES-RESET ---
/**
 * Setzt den schaltungsspezifischen Tageswert um Mitternacht auf 0.
 */
schedule("0 0 * * *", () => {
    setState(ID_TOTAL, 0, true);
    console.log("[Waschmaschine] Statistik für den neuen Tag zurückgesetzt.");
});

// --- 4. HAUPTLOGIK ---

on({ id: ID_POWER, change: 'ne' }, (obj) => {
    const watt = obj.state.val;

    // START-PHASE
    if (watt > START_WATT && !isRunning) {
        if (timerEnd) { clearTimeout(timerEnd); timerEnd = null; }
        
        isRunning = true;
        startTime = Date.now();
        startEnergy = getState(ID_ENERGY).val; // Fixierung des Zählerstands beim Start
        
        console.log("[Waschmaschine] Waschgang gestartet bei " + startEnergy + " kWh.");
    }

    // ENDE-PHASE (Timer-Start)
    if (watt < END_WATT && isRunning && !timerEnd) {
        timerEnd = setTimeout(processFinish, END_DELAY);
    }
});

/**
 * Berechnet Verbrauch, Kosten und Dauer nach Abschluss des Waschgangs.
 */
function processFinish() {
    const endEnergy = getState(ID_ENERGY).val;
    const priceKwh = getState(ID_PRICE).val || 0.30;
    
    // Aktuellen Verbrauch berechnen
    const diffEnergy = Math.max(0, endEnergy - startEnergy);
    const totalCost = diffEnergy * priceKwh;
    
    // Dauer berechnen (abzüglich der 2 Minuten Wartezeit)
    const durationMs = Date.now() - startTime - END_DELAY;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const timeStr = hours + ":" + (minutes < 10 ? '0' + minutes : minutes) + " Std.";

    // Neuen Statistik-Wert speichern
    const currentTotal = getState(ID_TOTAL).val || 0;
    const newTotal = currentTotal + diffEnergy;
    setState(ID_TOTAL, newTotal, true);

    // Telegram-Meldung
    const msg = `🧺 Die Waschmaschine ist fertig. Dauer: ${timeStr}. ` +
                `Verbrauch: ${diffEnergy.toFixed(2)} kWh (${totalCost.toFixed(2)} €). ` +
                `Heute gesamt: ${newTotal.toFixed(2)} kWh.`;

    sendTo('telegram', { text: msg });
    console.log("[Waschmaschine] " + msg);
    
    // Status zurücksetzen
    isRunning = false;
    timerEnd = null;
}