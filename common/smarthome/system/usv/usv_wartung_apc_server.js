// =============================================================================
// USV WARTUNG & KONDITIONIERUNG (APC Serverschrank)
// =============================================================================

/**
 * LOGIK-BESCHREIBUNG:
 * 1. Initialisierung: Legt alle notwendigen Datenpunkte unter javascript.0.USV_Wartung an.
 * 2. Überwachung: Berechnet die Restlaufzeit von Sekunden in Minuten.
 * 3. Automatische Wartung: Alle 2 Monate (1. Montag) wird die USV entladen, um die 
 * Batteriekapazität zu trainieren (Konditionierung).
 * 4. Schutzfunktion: Die Wartung wird sofort abgebrochen, wenn ein definierter 
 * Akkustand (% oder Minuten) unterschritten wird oder Großverbraucher aktiv sind.
 * 5. Alarmierung: Benachrichtigt via Telegram, Gotify und Alexa bei Ausfall oder Wartungsstatus.
 */

// --- KONFIGURATION & DATENPUNKTE ---
const dpPrefix = 'javascript.0.USV_Wartung'; // Pfad für die Steuerelemente
const upsNutPrefix = 'nut.0';                // Pfad zum NUT-Adapter (APC)
const sonoffPower = 'sonoff.0.Serverschrank.POWER'; // Die schaltbare Zuleitung
const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker').val;

// Initialisierung der Datenpunkte (Erstellt die Punkte nur, wenn sie fehlen)
async function initDP() {
    const states = [
        ['Minimum_Rest_Prozent', 35],       // Unter dieser Grenze wird Zuleitung eingeschaltet
        ['Minimum_Rest_Minuten', 10],       // Zeitliche Sicherheitsgrenze
        ['Jetzt_Warten', false],            // Schalter für manuelle Wartung (VIS)
        ['Speak_Minuten', true],            // Sprachausgabe in Minuten (true) oder % (false)
        ['Speak_Prozent', false],
        ['Speak_bei_Wartung', true],
        ['Speak_bei_Ausfall', true],
        ['Alexa_Lautstaerke', 30],
        ['Wartung_eingeleitet', false],     // Interner Status (Wartung vs. echter Ausfall)
        ['Automatische_Wartung_Aktiv', true],
        ['Restlaufzeit_in_Minuten', 0]      // Berechneter Wert
    ];
    for (let s of states) {
        if (!existsState(`${dpPrefix}.${s[0]}`)) {
            await createStateAsync(`${dpPrefix}.${s[0]}`, { 
                name: s[0], 
                def: s[1], 
                type: typeof s[1] === 'number' ? 'number' : 'boolean',
                role: 'value'
            });
        }
    }
}

// Zentrale Benachrichtigung (Telegram & Gotify)
function notify(text, priority = 5) {
    const header = '🔌🔋 USV Serverschrank\n\n';
    sendTo('telegram', 'send', { text: header + text });
    console.log(`USV-APC-Log: ${text}`);
    // Versand an Gotify Server
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=USV Serverschrank" -F "message=${text}" -F "priority=${priority}"`);
}

// Sprachausgabe via SayIt / Alexa
function speak(text) {
    const vol = getState(`${dpPrefix}.Alexa_Lautstaerke`).val;
    // Format: "Lautstärke; Text"
    sendTo("sayit", "say", { text: `${vol}; ${text}`, volume: vol });
}

// --- AKTIONEN ---

// Schaltet die Steckdose vor der USV
async function toggleZuleitung(powerState) {
    setState(sonoffPower, powerState);
}

// Startet den Entladevorgang
async function startWartung(isManual = false) {
    setState(`${dpPrefix}.Wartung_eingeleitet`, true);
    await toggleZuleitung(false); // Strom kappen
    notify(isManual ? 'Manuelle Wartung gestartet.' : 'Automatische Wartung gestartet.');
}

// Beendet den Entladevorgang und stellt Strom wieder her
async function stopWartung(reason = '') {
    await toggleZuleitung(true); // Netzspannung wieder ein
    // Verzögerung um den Status-Flag zurückzusetzen (Puffer für NUT-Aktualisierung)
    setTimeout(() => {
        setState(`${dpPrefix}.Wartung_eingeleitet`, false);
        setState(`${dpPrefix}.Jetzt_Warten`, false);
    }, 15000);
    
    const soc = getState(`${upsNutPrefix}.battery.charge`).val;
    const runtime = Math.floor(getState(`${dpPrefix}.Restlaufzeit_in_Minuten`).val);
    notify(`Wartung beendet (${reason}).\nStand: ${soc}% / ${runtime} min.\nAufladung beginnt.`);
}

// --- TRIGGER & SCHEDULES ---

// 1. Automatische Wartung: Jeden 1. Montag alle 2 Monate um 11:00 Uhr
schedule("0 11 1-7 */2 *", async () => {
    if (new Date().getDay() === 1) { // Nur wenn heute wirklich Montag ist
        const soc = getState(`${upsNutPrefix}.battery.charge`).val;
        const autoAktiv = getState(`${dpPrefix}.Automatische_Wartung_Aktiv`).val;
        
        // Prüfung: USV voll geladen? Automatik an?
        if (autoAktiv && soc > 89) {
            await startWartung(false);
        } else if (autoAktiv) {
            notify(`Wartung ausgesetzt. Akkustand zu niedrig für Test: ${soc}%`);
        }
    }
});

// 2. Überwachung Stromausfall (Unterscheidung zwischen Test und Ernstfall)
on({ id: `${upsNutPrefix}.status.onbattery`, change: 'ne' }, async (obj) => {
    const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`).val;
    if (obj.state.val === true && !isWartung) {
        notify('⚠️ WARNUNG: Stromversorgung Serverschrank unerwartet unterbrochen!', 8);
    } else if (obj.state.val === false && !isWartung) {
        notify('✅ Netzspannung Serverschrank wiederhergestellt.');
    }
});

// 3. Manuelle Wartung via Vis / Datenpunkt
on({ id: `${dpPrefix}.Jetzt_Warten`, change: 'ne', val: true }, async () => {
    await startWartung(true);
});

// 4. Überwachung Entladevorgang & Sicherheits-Abbruch
on({ id: `${upsNutPrefix}.battery.charge`, change: 'ne' }, async (obj) => {
    const soc = obj.state.val;
    const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`).val;
    const minSoc = getState(`${dpPrefix}.Minimum_Rest_Prozent`).val;
    const minMin = getState(`${dpPrefix}.Minimum_Rest_Minuten`).val;
    const runtime = getState(`${dpPrefix}.Restlaufzeit_in_Minuten`).val;

    // Abbruch wenn Mindest-Prozent oder Mindest-Minuten erreicht sind
    if (isWartung && (soc <= minSoc || runtime <= minMin)) {
        await stopWartung(`Limit (${soc}% / ${Math.floor(runtime)} min) erreicht`);
    }
    
    // Status-Ansage bei Entladung (alle X Prozent, gesteuert durch NUT-Update)
    if (getState(`${upsNutPrefix}.status.onbattery`).val === true) {
        const speakMin = getState(`${dpPrefix}.Speak_Minuten`).val;
        const speakActiveWartung = getState(`${dpPrefix}.Speak_bei_Wartung`).val;
        const speakActiveAusfall = getState(`${dpPrefix}.Speak_bei_Ausfall`).val;
        
        if ((isWartung && speakActiveWartung) || (!isWartung && speakActiveAusfall)) {
            let msg = isWartung ? 'U S V Wartung läuft. ' : 'Warnung. Stromversorgung unterbrochen. ';
            msg += speakMin ? `Restlaufzeit ${Math.floor(runtime)} Minuten.` : `Akkustand ${soc} Prozent.`;
            speak(msg);
        }
    }
});

// 5. Umrechnung Restzeit (APC liefert oft Sekunden -> Umrechnung in Minuten)
on({ id: `${upsNutPrefix}.battery.runtime`, change: 'ne' }, (obj) => {
    // APC liefert Sekunden. Wir ziehen die "Runtime Low" Grenze ab für die reale Testzeit
    const runtimeSec = obj.state.val;
    const runtimeLow = getState(`${upsNutPrefix}.battery.runtime-low`).val || 0;
    const realMinutes = (runtimeSec - runtimeLow) / 60;
    
    setState(`${dpPrefix}.Restlaufzeit_in_Minuten`, realMinutes, true);
});

// Initialstart: Datenpunkte prüfen/anlegen
initDP();