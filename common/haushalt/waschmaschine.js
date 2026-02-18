/**
 * Name:   Waschmaschinen-Wächter v2.5
 * Zweck:  Überwachung von Laufzeit und Verbrauch (Isolated Edition)
 */

// --- KONFIGURATION ---
const GrenzWertInWatt = 3;      
const timeout_zeit = 300000;    // 5 Minuten

const ID_POWER = 'alias.0.waschen.wasch.ENERGY_Power';
const ID_TOTAL = 'alias.0.waschen.wasch.ENERGY_Total';
const ID_TODAY = 'alias.0.waschen.wasch.ENERGY_Today';
const ID_RUNNING = '0_userdata.0.Haushalt.waschen';

const ID_START_VAL = '0_userdata.0.Haushalt.waschen_energie_start';
const ID_START_TIME = '0_userdata.0.Haushalt.waschen_zeit_start';

const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';

let timeout_waschmaschine = null;

async function erstelleDatenpunkte() {
    if (!existsState(ID_START_TIME)) await createStateAsync(ID_START_TIME, 0, {type: 'number', name: 'Waschmaschine Startzeit'});
    if (!existsState(ID_START_VAL))  await createStateAsync(ID_START_VAL, 0, {type: 'number', name: 'Waschmaschine Start-Energie'});
}
erstelleDatenpunkte();

on({ id: ID_POWER, change: 'ne' }, async (obj) => {
    const watt = obj.state.val;
    const laeuft = getState(ID_RUNNING).val;

    if (watt > GrenzWertInWatt && !laeuft) {
        const aktuellerZaehler = Number(getState(ID_TOTAL).val);
        setState(ID_START_VAL, aktuellerZaehler, true);
        setState(ID_START_TIME, Date.now(), true);
        setState(ID_RUNNING, true, true);
        console.log(`[Waschmaschine] Start erkannt: Zählerstand ${aktuellerZaehler} kWh gespeichert.`);
    } 
    else if (watt < GrenzWertInWatt && laeuft) {
        if (!timeout_waschmaschine) {
            console.log(`[Waschmaschine] Leistung unter Schwellwert. Timer gestartet...`);
            timeout_waschmaschine = setTimeout(() => {
                abschlussWaschmaschine();
            }, timeout_zeit);
        }
    } 
    else if (watt >= GrenzWertInWatt && laeuft && timeout_waschmaschine) {
        console.log(`[Waschmaschine] Maschine arbeitet weiter. Timer gelöscht.`);
        clearTimeout(timeout_waschmaschine);
        timeout_waschmaschine = null;
    }
});

async function abschlussWaschmaschine() {
    const ende = Number(getState(ID_TOTAL).val);
    const start = Number(getState(ID_START_VAL).val);
    const startZeit = Number(getState(ID_START_TIME).val);
    const kwhHeute = Number(getState(ID_TODAY).val) || 0;
    
    const dauerMin = Math.round((Date.now() - startZeit - timeout_zeit) / 60000);
    let verbrauch = Number((ende - start).toFixed(3));
    
    // Korrektur bei Fehlmessung
    if (verbrauch <= 0 && kwhHeute > 0) verbrauch = 0.01; 

    setState(ID_RUNNING, false, true);
    await MeldenWaschen("Waschmaschine", dauerMin, verbrauch, kwhHeute);
    timeout_waschmaschine = null;
}

async function MeldenWaschen(name, min, kwh, kwhHeute) {
    const std = Math.floor(min / 60);
    const m = (min % 60).toString().padStart(2, '0');
    const preis = getState('0_userdata.0.Energie.Strompreise.akt_Preis').val || 0.30;
    
    const msg = `Die ${name} ist fertig. Dauer: ${std}:${m} Std. Verbrauch: ${kwh.toFixed(2)} kWh (${(kwh * preis).toFixed(2)} €). Heute gesamt: ${kwhHeute.toFixed(2)} kWh.`;
    
    console.log(`[${name}] ${msg}`);
    sendTo('telegram', 'send', { text: `🧺 ${msg}` });
    
    const token = getState(ID_GOTIFY_TOKEN).val;
    if (token) {
        httpPost(`https://${GOTIFY_SERVER}/message?token=${token}`, { title: name, message: msg, priority: 1 });
    }

    if (compareTime('08:00', '20:00', 'between')) {
        sendTo("sayit", "say", { text: `Die ${name} ist fertig.` });
    }
}