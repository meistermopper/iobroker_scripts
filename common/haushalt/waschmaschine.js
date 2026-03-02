/**
 * =============================================================================
 * SKRIPT: WASCHMASCHINEN-ÜBERWACHUNG (V2.9)
 * =============================================================================
 * ZWECK: Überwachung von Start/Ende und Energie-Statistik.
 * ANPASSUNG: Verbesserte Timer-Logik gegen Fehlmessungen und 0-Watt-Bug.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const ID_POWER  = 'alias.0.waschen.wasch.ENERGY_Power';  // Aktuelle Leistung (Watt)
const ID_ENERGY = 'alias.0.waschen.wasch.ENERGY_Total';  // Gesamt-Zähler (kWh)

const PATH_STAT = '0_userdata.0.Energie.Statistik';
const PATH_PRIC = '0_userdata.0.Energie.Strompreise';

const ID_PRICE  = `${PATH_PRIC}.akt_Preis`;        
const ID_TOTAL  = `${PATH_STAT}.Waschmaschine_Tag`; 
const ID_GOTIFY = '0_userdata.0.gotifytoken.iobroker'; 

const ID_VIS    = '0_userdata.0.Haushalt.waschen'; 

const START_WATT = 10;     // Start-Schwelle in Watt
const END_WATT   = 3;      // Ende-Schwelle (Standby)
const END_DELAY  = 120000; // 2 Minuten Pufferzeit

// Interne Variablen
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
    console.log("[Waschmaschine] Initialisierung v2.9 abgeschlossen.");
}
initWaschSystem();

// --- 3. KOMMUNIKATIONS-ZENTRALE ---
function washNotify(text) {
    sendTo('telegram', { text: text });

    const stateGotify = getState(ID_GOTIFY);
    const token = stateGotify ? stateGotify.val : null;
    if (token) {
        exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=Haushalt" -F "message=${text}" -F "priority=5"`);
    }

    if (compareTime('08:00', '20:00', 'between')) {
        sendTo("sayit", "say", { text: "Die Waschmaschine ist fertig." });
    }
    console.log("[Waschmaschine] Benachrichtigung: " + text);
}

// --- 4. TAGES-RESET ---
schedule("0 0 * * *", () => {
    setState(ID_TOTAL, 0, true);
    console.log("[Waschmaschine] Statistik-Reset für neuen Tag.");
});

// --- 5. HAUPTLOGIK ---
on({ id: ID_POWER, change: 'ne' }, (obj) => {
    const watt = parseFloat(obj.state.val);

    // START-ERKENNUNG
    if (watt > START_WATT && !isRunning) {
        // Falls noch ein alter "Ende-Timer" läuft (weil Maschine kurz aus war), stoppen
        if (timerEnd) { 
            clearTimeout(timerEnd); 
            timerEnd = null; 
            console.log("[Waschmaschine] Start erkannt - Ende-Timer abgebrochen.");
        }
        
        isRunning = true;
        startTime = Date.now();
        const curEnergy = getState(ID_ENERGY).val;
        startEnergy = (curEnergy !== null) ? parseFloat(curEnergy) : 0;
        
        setState(ID_VIS, true, true);
        console.log(`[Waschmaschine] Waschgang gestartet (Zählerstand: ${startEnergy} kWh).`);
    }

    // ÜBERWACHUNG WÄHREND DES LAUFS
    if (isRunning) {
        // Fall A: Leistung fällt unter Ende-Schwelle -> Timer starten
        if (watt < END_WATT && !timerEnd) {
            console.log("[Waschmaschine] Leistung niedrig. Warte auf Bestätigung des Endes...");
            timerEnd = setTimeout(processFinish, END_DELAY);
        }
        
        // Fall B: Leistung steigt wieder ÜBER Ende-Schwelle -> Timer löschen (Spülpause beendet)
        if (watt >= END_WATT && timerEnd) {
            clearTimeout(timerEnd);
            timerEnd = null;
            console.log("[Waschmaschine] Leistung wieder gestiegen. Timer zurückgesetzt.");
        }
    }
});

function processFinish() {
    const stateEnergy = getState(ID_ENERGY);
    const endEnergy = (stateEnergy && stateEnergy.val !== null) ? parseFloat(stateEnergy.val) : startEnergy;
    
    const statePrice = getState(ID_PRICE);
    const priceKwh = (statePrice && statePrice.val !== null) ? parseFloat(statePrice.val) : 0.30;
    
    // Mathematische Berechnung des Verbrauchs
    // $$Verbrauch = Zählerstand_{Ende} - Zählerstand_{Start}$$
    const diffEnergy = Math.max(0, endEnergy - startEnergy);
    const totalCost = diffEnergy * priceKwh;
    
    // Zeitberechnung
    const durationMs = Date.now() - startTime - END_DELAY;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const timeStr = `${hours}:${minutes < 10 ? '0' + minutes : minutes} Std.`;

    // Tagesstatistik aktualisieren
    const stateTotal = getState(ID_TOTAL);
    const currentTotal = (stateTotal && stateTotal.val !== null) ? parseFloat(stateTotal.val) : 0;
    const newTotal = currentTotal + diffEnergy;
    setState(ID_TOTAL, newTotal, true);

    const msg = `🧺 Die Waschmaschine ist fertig.\nDauer: ${timeStr}\n` +
                `Verbrauch: ${diffEnergy.toFixed(2)} kWh (${totalCost.toFixed(2)} €)\n` +
                `Heute gesamt: ${newTotal.toFixed(2)} kWh.`;

    washNotify(msg);
    
    setState(ID_VIS, false, true); 
    isRunning = false;
    timerEnd = null;
}