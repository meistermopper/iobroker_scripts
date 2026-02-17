/**
 * Name:   Waschmaschinen-Wächter (Total-Energy-Edition)
 * Zweck:  Überwachung von Laufzeit und Verbrauch mittels Gesamtzählerstand.
 */

// --- KONFIGURATION ---
const GrenzWertInWatt = 3;      // Schwellwert für Standby/Betrieb
const timeout_zeit = 300000;    // 5 Minuten (300.000 ms) Puffer gegen Spülpausen

const ID_POWER = 'alias.0.waschen.wasch.ENERGY_Power';
const ID_TOTAL = 'alias.0.waschen.wasch.ENERGY_Total';
const ID_TODAY = 'alias.0.waschen.wasch.ENERGY_Today';
const ID_RUNNING = '0_userdata.0.Haushalt.waschen';

// Speicherpunkte in userdata (überstehen Neustarts)
const ID_START_VAL = '0_userdata.0.Haushalt.waschen_energie_start';
const ID_START_TIME = '0_userdata.0.Haushalt.waschen_zeit_start';

const GOTIFY_SERVER = 'mygotify.meistermopper.de';
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';

let timeout_waschmaschine = null;

// Sicherstellen, dass die Speicherpunkte existieren
async function erstelleDatenpunkte() {
    if (!existsState(ID_START_TIME)) await createStateAsync(ID_START_TIME, 0, {type: 'number', name: 'Waschmaschine Startzeit'});
    if (!existsState(ID_START_VAL))  await createStateAsync(ID_START_VAL, 0, {type: 'number', name: 'Waschmaschine Start-Energie (Total)'});
}
erstelleDatenpunkte();

// TRIGGER: Überwachung der Leistung (Watt)
on({ id: ID_POWER, change: 'ne' }, async (obj) => {
    const watt = obj.state.val;
    const laeuft = getState(ID_RUNNING).val;

    // START: Waschmaschine beginnt zu arbeiten
    if (watt > GrenzWertInWatt && !laeuft) {
        const aktuellerZaehler = Number(getState(ID_TOTAL).val);
        const jetzt = Date.now();

        setState(ID_START_VAL, aktuellerZaehler, true);
        setState(ID_START_TIME, jetzt, true);
        setState(ID_RUNNING, true, true);
        
        console.log(`[Waschmaschine] Start erkannt: Gesamtzählerstand ${aktuellerZaehler} kWh gespeichert.`);
    } 
    
    // FERTIG-CHECK: Leistung sinkt unter Schwellwert
    else if (watt < GrenzWertInWatt && laeuft) {
        if (!timeout_waschmaschine) {
            console.log(`[Waschmaschine] Leistung unter Schwellwert. Warte ${timeout_zeit/60000} Min auf Abschluss...`);
            checkWaschmaschineFertig(true);
        }
    } 
    
    // MASCHINE ARBEITET NOCH (Timer löschen)
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
            
            // Dauer berechnen (Abzug der Pufferzeit für korrekte Laufzeitangabe)
            const dauerMinTotal = Math.round((Date.now() - start_zeit - timeout_zeit) / 60000);
            
            // Differenzmessung über Gesamtzähler (Total)
            let kwhWaschgang = Math.max(0, energie_ende - energie_start);
            const kwhHeute = getState(ID_TODAY).val || 0;
            
            if (kwhWaschgang < 0.01) {
                console.warn(`[Waschmaschine] Differenzmessung sehr niedrig (${kwhWaschgang.toFixed(3)} kWh).`);
            }

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
    
    // 1. Telegram
    sendTo('telegram', 'send', { text: `💦🧺 ${msgRaw}` });
    
    // 2. Gotify
    const token = getState(ID_GOTIFY_TOKEN).val;
    if (token) {
        const url = `https://${GOTIFY_SERVER}/message?token=${token}`;
        httpPost(url, { title: "Waschmaschine", message: msgRaw, priority: 1 });
    }

    // 3. Sprachausgabe (08:00 - 20:00 Uhr)
    if (compareTime('08:00', '20:00', 'between')) {
        sendTo("sayit", "say", { text: 'Die Waschmaschine ist fertig.' });
    }
}