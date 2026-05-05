/**
 * =============================================================================
 * SKRIPT: WASCHMASCHINEN-ÜBERWACHUNG (V2.9.4)
 * =============================================================================
 * ZWECK: Überwachung von Start/Ende und Energie-Statistik.
 * FIX: Syntax-Fehler (doppelte Deklaration) entfernt.
 * FIX: Nutzt getStateAsync für den Final-Check (Cache-Bypass).
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
    console.log("Waschmaschine: Initialisierung v2.9.4 abgeschlossen");
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
    console.log("Waschmaschine: Benachrichtigung gesendet");
}

// --- 4. TAGES-RESET ---
schedule("0 0 * * *", () => {
    setState(ID_TOTAL, 0, true);
    //console.log("[Waschmaschine] Statistik-Reset für neuen Tag");
});

// --- 5. HAUPTLOGIK ---
on({ id: ID_POWER, change: 'ne' }, (obj) => {
    const watt = parseFloat(obj.state.val);

    // START-ERKENNUNG
    if (watt > START_WATT && !isRunning) {
        // Falls ein alter "Ende-Timer" läuft, wird dieser gestoppt.
        if (timerEnd) {
            clearTimeout(timerEnd);
            timerEnd = null;
            console.log("Waschmaschine: Start erkannt, Ende-Timer abgebrochen");
        }

        // Status sofort setzen, um Logik zu starten und Mehrfach-Trigger zu verhindern
        isRunning = true;
        startTime = Date.now(); // Der Startzeitpunkt ist der erste Leistungsanstieg
        setState(ID_VIS, true, true);
        console.log("Waschmaschine: Waschgang gestartet. Lese Start-Zählerstand in 15 Sekunden");

        // Verzögertes Lesen des Zählerstands, um der Steckdose Zeit zum Aktualisieren zu geben.
        setTimeout(() => {
            const stateEnergy = getState(ID_ENERGY);
            if (stateEnergy && stateEnergy.val !== null) {
                startEnergy = parseFloat(stateEnergy.val);
                console.log(`Waschmaschine: Start-Zählerstand erfasst: ${startEnergy.toFixed(3)} kWh`);
            } else {
                console.warn(`Waschmaschine: Konnte Start-Zählerstand nach 15s nicht lesen. startEnergy bleibt ${startEnergy}. Berechnung ungenau`);
            }
        }, 15000); // 15 Sekunden Wartezeit
    }

    // ÜBERWACHUNG WÄHREND DES LAUFS
    if (isRunning) {
        // Fall A: Leistung fällt unter Ende-Schwelle -> Timer starten
        if (watt < END_WATT && !timerEnd) {
            console.log("Waschmaschine: Leistung niedrig, warte auf Bestätigung des Endes");
            timerEnd = setTimeout(processFinish, END_DELAY);
        }


        // Fall B: Leistung steigt wieder ÜBER Ende-Schwelle -> Timer löschen (Spülpause beendet)
        if (watt >= END_WATT && timerEnd) {
            clearTimeout(timerEnd);
            timerEnd = null;
            console.log("Waschmaschine: Leistung wieder gestiegen, Timer zurückgesetzt");
        }
    }
});

async function processFinish() {
    // Erster Leseversuch
    let stateEnergy = getState(ID_ENERGY);

    if (!stateEnergy || stateEnergy.val === null || typeof stateEnergy.val === 'undefined') {
        console.error("Waschmaschine: FEHLER, konnte den finalen Energiezählerstand nicht lesen");
        // Status zurücksetzen, ohne eine falsche Benachrichtigung zu senden.
        isRunning = false;
        timerEnd = null;
        setState(ID_VIS, false, true);
        return; // Funktion verlassen
    }

    // Sicherheits-Pause für die Übertragung der letzten Watts/kWh
    console.log("Waschmaschine: Warte 10s auf finalen Zählerstand (Datenbank-Sync)");
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Jetzt erzwingen wir ein asynchrones Lesen direkt aus dem ioBroker-Core (Bypass Cache)
    const stateEnergyFinal = await getStateAsync(ID_ENERGY);
    const endEnergy = (stateEnergyFinal && stateEnergyFinal.val !== null) ? parseFloat(stateEnergyFinal.val) : parseFloat(stateEnergy.val);

    const statePrice = getState(ID_PRICE);
    const priceKwh = (statePrice && statePrice.val !== null) ? parseFloat(statePrice.val) : 0.30;


    // Mathematische Berechnung des Verbrauchs
    // $$Verbrauch = Zählerstand_{Ende} - Zählerstand_{Start}$$
    const diffEnergy = Math.max(0, endEnergy - startEnergy);
    const totalCost = diffEnergy * priceKwh;

    // DEBUG: Werte ins Log schreiben, um das 0-kWh-Problem zu finden
    // Validierung: Falls immer noch 0,00 rauskommt, liegt es am Datenpunkt
    if (diffEnergy === 0) {
        console.warn(`Waschmaschine: ACHTUNG! Zählerstand hat sich nicht verändert (Start: ${startEnergy} / Ende: ${endEnergy}). ` +
                     `Prüfe, ob der Datenpunkt ${ID_ENERGY} im Objects-Tab aktualisiert wird.`);
    }

    console.log(`Waschmaschine: Ende erkannt, Start ${startEnergy.toFixed(3)} kWh -> Ende ${endEnergy.toFixed(3)} kWh = Diff ${diffEnergy.toFixed(3)} kWh`);

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
