/**
 * Name:   Trockner-Wächter v2.5
 * Zweck:  Überwachung von Laufzeit und Verbrauch (Isolated Edition)
 */

// --- KONFIGURATION TROCKNER ---
const GrenzWertInWatt = 3;      
const timeout_zeit = 300000;    

const ID_POWER = 'alias.0.waschen.trocknen.ENERGY_Power';
const ID_TOTAL = 'alias.0.waschen.trocknen.ENERGY_Total';
const ID_TODAY = 'alias.0.waschen.trocknen.ENERGY_Today';
const ID_RUNNING = '0_userdata.0.Haushalt.trocknen';

// EIGENE SPEICHERPUNKTE FÜR TROCKNER
const ID_START_VAL = '0_userdata.0.Haushalt.trocknen_energie_start';
const ID_START_TIME = '0_userdata.0.Haushalt.trocknen_zeit_start';

const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';

let timeout_trockner = null;

async function erstelleDatenpunkteTrockner() {
    if (!existsState(ID_START_TIME)) await createStateAsync(ID_START_TIME, 0, {type: 'number', name: 'Trockner Startzeit'});
    if (!existsState(ID_START_VAL))  await createStateAsync(ID_START_VAL, 0, {type: 'number', name: 'Trockner Start-Energie'});
}
erstelleDatenpunkteTrockner();

on({ id: ID_POWER, change: 'ne' }, async (obj) => {
    const watt = obj.state.val;
    const laeuft = getState(ID_RUNNING).val;

    if (watt > GrenzWertInWatt && !laeuft) {
        const aktuellerZaehler = Number(getState(ID_TOTAL).val);
        setState(ID_START_VAL, aktuellerZaehler, true);
        setState(ID_START_TIME, Date.now(), true);
        setState(ID_RUNNING, true, true);
        console.log(`[Trockner] Start erkannt: Zählerstand ${aktuellerZaehler} kWh gespeichert.`);
    } 
    else if (watt < GrenzWertInWatt && laeuft) {
        if (!timeout_trockner) {
            console.log(`[Trockner] Leistung unter Schwellwert. Timer gestartet...`);
            timeout_trockner = setTimeout(() => {
                abschlussTrockner();
            }, timeout_zeit);
        }
    } 
    else if (watt >= GrenzWertInWatt && laeuft && timeout_trockner) {
        console.log(`[Trockner] Maschine arbeitet weiter. Timer gelöscht.`);
        clearTimeout(timeout_trockner);
        timeout_trockner = null;
    }
});

async function abschlussTrockner() {
    const ende = Number(getState(ID_TOTAL).val);
    const start = Number(getState(ID_START_VAL).val);
    const startZeit = Number(getState(ID_START_TIME).val);
    const kwhHeute = Number(getState(ID_TODAY).val) || 0;
    
    const dauerMin = Math.round((Date.now() - startZeit - timeout_zeit) / 60000);
    let verbrauch = Number((ende - start).toFixed(3));
    
    if (verbrauch <= 0 && kwhHeute > 0) verbrauch = 0.01; 

    setState(ID_RUNNING, false, true);
    await MeldenTrocknen("Trockner", dauerMin, verbrauch, kwhHeute);
    timeout_trockner = null;
}

async function MeldenTrocknen(name, min, kwh, kwhHeute) {
    const std = Math.floor(min / 60);
    const m = (min % 60).toString().padStart(2, '0');
    const preis = getState('0_userdata.0.Energie.Strompreise.akt_Preis').val || 0.30;
    
    const msg = `Der ${name} ist fertig. Dauer: ${std}:${m} Std. Verbrauch: ${kwh.toFixed(2)} kWh (${(kwh * preis).toFixed(2)} €). Heute gesamt: ${kwhHeute.toFixed(2)} kWh.`;
    
    console.log(`[${name}] ${msg}`);
    sendTo('telegram', 'send', { text: `☀️💨 ${msg}` });
    
    const token = getState(ID_GOTIFY_TOKEN).val;
    if (token) {
        httpPost(`https://${GOTIFY_SERVER}/message?token=${token}`, { title: name, message: msg, priority: 1 });
    }

    if (compareTime('08:00', '20:00', 'between')) {
        sendTo("sayit", "say", { text: 'Der Trockner ist fertig.' });
    }
}