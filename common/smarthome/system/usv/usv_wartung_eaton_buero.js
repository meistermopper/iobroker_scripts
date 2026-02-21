// =============================================================================
// USV WARTUNG & KONDITIONIERUNG (Büro)
// =============================================================================

// --- KONFIGURATION & DATENPUNKTE ---
const dpPrefix = 'javascript.0.USV_Wartung1';
const upsNutPrefix = 'nut.1';
const sonoffPower = 'alias.0.buero.usv.POWER';
const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker').val;

// Initialisierung der Datenpunkte
async function initDP() {
    const states = [
        ['Minimum_Rest_Prozent', 35],
        ['Minimum_Rest_Minuten', 10],
        ['Jetzt_Warten', false],
        ['Speak_Minuten', true],
        ['Speak_Prozent', false],
        ['Speak_bei_Wartung', true],
        ['Speak_bei_Ausfall', true],
        ['Alexa_Lautstaerke', 30],
        ['Wartung_eingeleitet', false],
        ['Automatische_Wartung_Aktiv', true],
        ['Restlaufzeit_in_Minuten', 0]
    ];
    for (let s of states) {
        if (!existsState(`${dpPrefix}.${s[0]}`)) {
            await createStateAsync(`${dpPrefix}.${s[0]}`, { name: s[0], def: s[1], type: typeof s[1] === 'number' ? 'number' : 'boolean' });
        }
    }
}

// Zentrale Benachrichtigung (Telegram & Gotify)
function notify(text, priority = 5) {
    const header = '🔌🔋 USV Büro\n\n';
    sendTo('telegram', 'send', { text: header + text });
    console.log(`USV-Log: ${text}`);
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=USV Wartung" -F "message=${text}" -F "priority=${priority}"`);
}

// Sprachausgabe via SayIt
function speak(text) {
    const vol = getState(`${dpPrefix}.Alexa_Lautstaerke`).val;
    sendTo("sayit", "say", { text: `${vol}; ${text}`, volume: vol });
}

// --- AKTIONEN ---

async function toggleZuleitung(powerState) {
    setState(sonoffPower, powerState); // Schaltet die Steckdose der USV (Sonoff)
}

async function startWartung(isManual = false) {
    setState(`${dpPrefix}.Wartung_eingeleitet`, true);
    await toggleZuleitung(false); // Trenne vom Netz zum Entladen
    notify(isManual ? 'Manuelle Wartung im Büro gestartet.' : 'Automatische Wartung im Büro gestartet.');
}

async function stopWartung(reason = '') {
    await toggleZuleitung(true); // Wieder ans Netz
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
    if (new Date().getDay() === 1) { // Montag
        const soc = getState(`${upsNutPrefix}.battery.charge`).val;
        const autoAktiv = getState(`${dpPrefix}.Automatische_Wartung_Aktiv`).val;
        
        if (autoAktiv && soc > 89) {
            await startWartung(false);
        } else if (autoAktiv) {
            notify(`Wartung ausgesetzt. Akkustand zu niedrig: ${soc}%`);
        }
    }
});

// 2. Überwachung Stromausfall (echter Ausfall vs. Wartung)
on({ id: `${upsNutPrefix}.status.onbattery`, change: 'ne' }, async (obj) => {
    const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`).val;
    if (obj.state.val === true && !isWartung) {
        notify('⚠️ WARNUNG: Stromversorgung unerwartet unterbrochen!', 8);
    } else if (obj.state.val === false && !isWartung) {
        notify('✅ Netzspannung wiederhergestellt.');
    }
});

// 3. Manuelle Wartung via Vis
on({ id: `${dpPrefix}.Jetzt_Warten`, change: 'ne', val: true }, async () => {
    await startWartung(true);
});

// 4. Überwachung Entladevorgang (Abbruch-Kriterien)
on({ id: `${upsNutPrefix}.battery.charge`, change: 'ne' }, async (obj) => {
    const soc = obj.state.val;
    const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`).val;
    const minSoc = getState(`${dpPrefix}.Minimum_Rest_Prozent`).val;

    if (isWartung && soc <= minSoc) {
        await stopWartung(`Limit ${minSoc}% erreicht`);
    }
    
    // Status-Ansage bei Entladung
    if (getState(`${upsNutPrefix}.status.onbattery`).val === true) {
        const runtime = Math.floor(getState(`${dpPrefix}.Restlaufzeit_in_Minuten`).val);
        const speakMin = getState(`${dpPrefix}.Speak_Minuten`).val;
        
        let text = isWartung ? 'Wartung im Büro läuft. ' : 'Warnung. Stromausfall im Büro. ';
        text += speakMin ? `Restlaufzeit ${runtime} Minuten.` : `Akkustand ${soc} Prozent.`;
        speak(text);
    }
});

// 5. Umrechnung Restzeit (Sekunden in Minuten)
on({ id: `${upsNutPrefix}.battery.runtime`, change: 'ne' }, (obj) => {
    setState(`${dpPrefix}.Restlaufzeit_in_Minuten`, Math.floor(obj.state.val / 60), true);
});

// Initialstart
initDP();