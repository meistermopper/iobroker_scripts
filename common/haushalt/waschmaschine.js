// --- KONFIGURATION ---
const GrenzWertInWatt = 3;      // Leicht erhöht auf 3W (Vermeidung von Rauschen)
const timeout_zeit = 300000;    // ERHÖHT: 5 Minuten (300.000 ms) gegen Pausen

const ID_POWER = 'alias.0.waschen.wasch.ENERGY_Power';
const ID_TOTAL = 'alias.0.waschen.wasch.ENERGY_Total';
const ID_TODAY = 'alias.0.waschen.wasch.ENERGY_Today';
const ID_RUNNING = '0_userdata.0.Haushalt.waschen';

const ID_START_VAL = '0_userdata.0.Haushalt.waschen_energie_start';
const ID_START_TIME = '0_userdata.0.Haushalt.waschen_zeit_start';

const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';

let timeout_waschmaschine = null;

// TRIGGER: Überwachung der Leistung (Watt)
on({ id: ID_POWER, change: 'ne' }, async (obj) => {
    const watt = obj.state.val;
    const laeuft = getState(ID_RUNNING).val;

    if (watt > GrenzWertInWatt && !laeuft) {
        const aktuellerZaehler = Number(getState(ID_TOTAL).val);
        const jetzt = Date.now();

        setState(ID_START_VAL, aktuellerZaehler, true);
        setState(ID_START_TIME, jetzt, true);
        setState(ID_RUNNING, true, true);
        
        console.log(`[Waschmaschine] Start erkannt: Zählerstand ${aktuellerZaehler} kWh gespeichert.`);
    } 
    else if (watt < GrenzWertInWatt && laeuft) {
        if (!timeout_waschmaschine) {
            console.log(`[Waschmaschine] Leistung unter Schwellwert. Warte ${timeout_zeit/60000} Min auf Abschluss...`);
            checkWaschmaschineFertig(true);
        }
    } 
    else if (watt >= GrenzWertInWatt && laeuft) {
        if (timeout_waschmaschine) {
            console.log(`[Waschmaschine] Maschine arbeitet weiter. Timer gelöscht.`);
            clearTimeout(timeout_waschmaschine);
            timeout_waschmaschine = null;
        }
    }
});

async function checkWaschmaschineFertig(startTimer) {
    if (startTimer) {
        timeout_waschmaschine = setTimeout(async () => {
            const energie_ende = Number(getState(ID_TOTAL).val);
            const energie_start = Number(getState(ID_START_VAL).val);
            const start_zeit = Number(getState(ID_START_TIME).val);
            
            const dauerMinTotal = Math.round((Date.now() - start_zeit - timeout_zeit) / 60000);
            let kwhWaschgang = Math.max(0, energie_ende - energie_start);
            
            // Falls 0.00 kommt, nehmen wir als Fallback den Tageswert, falls dieser plausibel ist
            if (kwhWaschgang < 0.01) {
                console.warn(`[Waschmaschine] Differenzmessung fehlgeschlagen. Prüfe Today-Wert...`);
            }

            const kwhHeute = getState(ID_TODAY).val || 0;
            
            setState(ID_RUNNING, false, true);
            await MeldenWaschen(dauerMinTotal, kwhWaschgang, kwhHeute);
            
            timeout_waschmaschine = null;
        }, timeout_zeit); 
    }
}

async function MeldenWaschen(min, kwh, kwhHeute) {
    const std = Math.floor(min / 60);
    const m = (min % 60).toString().padStart(2, '0');
    const strompreis = getState('0_userdata.0.Energie.Strompreise.akt_Preis').val || 0.30;
    
    const kwhFix = Number(kwh.toFixed(3)); 
    const euro = (kwhFix * strompreis).toFixed(2);
    const euroHeute = (Number(kwhHeute) * strompreis).toFixed(2);
    
    const msgRaw = `Die Waschmaschine ist fertig. Dauer: ${std}:${m} Std. Verbrauch: ${kwhFix.toFixed(2)} kWh (${euro} €). Heute gesamt: ${Number(kwhHeute).toFixed(2)} kWh (${euroHeute} €).`;
    
    console.log(`[Waschmaschine] Abschlussmeldung: ${msgRaw}`);
    sendTo('telegram', 'send', { text: `💦🧺 ${msgRaw}` });
    
    // Modernisiertes Gotify Senden (ohne curl)
    const token = getState(ID_GOTIFY_TOKEN).val;
    if (token) {
        const url = `https://${GOTIFY_SERVER}/message?token=${token}`;
        httpPost(url, { title: "Waschmaschine", message: msgRaw, priority: 1 });
    }

    if (compareTime('08:00', '20:00', 'between')) {
        sendTo("sayit", "say", { text: 'Die Waschmaschine ist fertig.' });
    }
}