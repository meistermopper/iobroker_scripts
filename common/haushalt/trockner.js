/**
 * Name:   Trockner-Wächter
 * Zweck:  Überwachung von Laufzeit und Verbrauch (Präzisions-Korrektur)
 */

let timeout_trockner = null;
let start_zeit = 0;
let energie_start = 0;
let strompreis = getState('0_userdata.0.Energie.Strompreise.akt_Preis').val || 0.30;

const ID_POWER   = 'alias.0.waschen.trocknen.ENERGY_Power';
const ID_TOTAL   = 'alias.0.waschen.trocknen.ENERGY_Total';
const ID_TODAY   = 'alias.0.waschen.trocknen.ENERGY_Today';
const ID_RUNNING = '0_userdata.0.Haushalt.trocknen';

// Strompreis-Update
on({ id: '0_userdata.0.Energie.Strompreise.akt_Preis', change: 'ne' }, obj => {
    strompreis = obj.state.val;
});

// TRIGGER: Überwachung der Leistung (Watt)
on({ id: ID_POWER, change: 'ne' }, async (obj) => {
    const watt = obj.state.val;
    const laeuft = getState(ID_RUNNING).val;

    // START: Nur wenn er nicht schon als "laufend" markiert ist
    if (watt > 10 && !laeuft) {
        start_zeit = Date.now();
        energie_start = getState(ID_TOTAL).val;
        setState(ID_RUNNING, true, true);
        console.log(`[Trockner] Start erkannt: Zählerstand ${energie_start} kWh`);
    } 
    
    // FERTIG-CHECK: Wenn Verbrauch niedrig, starte Timer (Knitterschutz-Überbrückung)
    else if (watt < 5 && laeuft) {
        checkFertig(true);
    } 
    
    // MASCHINE ARBEITET NOCH (Timer abbrechen)
    else if (watt >= 5 && laeuft) {
        if (timeout_trockner) {
            clearTimeout(timeout_trockner);
            timeout_trockner = null;
        }
    }
});

async function checkFertig(startTimer) {
    if (timeout_trockner) {
        clearTimeout(timeout_trockner);
        timeout_trockner = null;
    }

    if (startTimer) {
        // 1 Minute Pufferzeit
        timeout_trockner = setTimeout(async () => {
            const energie_ende = getState(ID_TOTAL).val;
            const dauerMinTotal = Math.round((Date.now() - start_zeit) / 60000);
            
            // Berechnung des Verbrauchs
            const kwh = Number(energie_ende) - Number(energie_start);
            const kwhHeute = getState(ID_TODAY).val;
            
            setState(ID_RUNNING, false, true);
            
            await MeldenTrockner(dauerMinTotal, kwh, kwhHeute);

            // Variablen-Reset für den nächsten Gang
            start_zeit = 0;
            energie_start = 0;
            timeout_trockner = null;
        }, 60000);
    }
}

async function MeldenTrockner(min, kwh, kwhHeute) {
    const std = Math.floor(min / 60);
    const m = (min % 60).toString().padStart(2, '0');
    
    // Plausibilitäts-Check (falls kwh fast 0 ist)
    const kwhFix = kwh > 0 ? kwh : 0.00;
    const euro = (kwhFix * strompreis).toFixed(2);
    const euroHeute = (kwhHeute * strompreis).toFixed(2);
    const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker').val;

    const textRaw = `💨 Der Trockner ist fertig. Dauer: ${std}:${m} Std. Verbrauch: ${kwhFix.toFixed(2)} kWh (${euro} €). Heute gesamt: ${kwhHeute.toFixed(2)} kWh (${euroHeute} €).`;

    console.log(`[Trockner] Abschlussmeldung: ${textRaw}`);

    // 1. Telegram (HTML)
    sendTo('telegram', 'send', { 
        text: `<pre>${textRaw}</pre>`, 
        parse_mode: 'HTML' 
    });
    
    // 2. Gotify (Modern)
    if (gotifyToken) {
        httpPost(`https://mygotify.meistermopper.de/message?token=${gotifyToken}`, {
            title: "ioBroker: Trockner",
            message: textRaw,
            priority: 1
        });
    }

    // 3. Sprachausgabe (Nur tagsüber)
    if (compareTime('08:00', '20:00', 'between')) {
        sendTo("sayit", "say", { text: 'Der Trockner ist fertig.' });
    } 
    
    // 4. Enigma2 (Nur abends/nachts)
    else {
        sendTo('enigma2.0', 'send', {
            message: textRaw,
            timeout: 15,
            msgType: 1
        });
    }
}