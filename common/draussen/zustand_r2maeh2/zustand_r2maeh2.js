/**
 * Name:   R2Mäh2 Mähroboter-Steuerung (Master)
 * Zweck:  Status, Frostwarnung, Durchschnitt & Steckdosen-Check
 */

const IDS = {
    power: 'draussen.r2maeh2.ENERGY_Power',
    socket_state: 'draussen.r2maeh2.POWER', // Die Steckdose selbst
    today: 'draussen.r2maeh2.ENERGY_Today',
    tempLow: 'pirate-weather.0.weather.daily.01.temperatureLow',
    userMaeht: '0_userdata.0.Energie.R2Mäh2.mäht',
    userListe: '0_userdata.0.Energie.R2Mäh2.Liste_Durchschnitt',
    userMittel: '0_userdata.0.Energie.R2Mäh2.Durchschnitt',
    gotify: '0_userdata.0.gotifytoken.iobroker'
};

let maeht = false;

function isSaison() {
    const monat = new Date().getMonth(); 
    return (monat >= 2 && monat <= 8); // März bis September
}

function notifyR2(text, priority = 1) {
    sendTo('telegram', 'send', { text: text });
    console.log(`R2Mäh2: ${text}`);
    const token = getState(IDS.gotify).val;
    if (token) {
        exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker: R2Mäh2" -F "message=${text}" -F "priority=${priority}"`);
    }
}

// --- NEU: STECKDOSEN-ÜBERWACHUNG ---
on({ id: IDS.socket_state, change: 'ne' }, (obj) => {
    // Wir melden nur, wenn sie ausgeschaltet wurde (false)
    if (obj.state.val === false) {
        notifyR2('❌ Die Steckdose von R2Mäh2 wurde ausgeschaltet!', 2);
    }
});

// --- 1. FROST-CHECK ---
schedule("1 18 * * *", () => {
    if (!isSaison()) return;
    const power = getState(IDS.power).val;
    const tempMorgen = getState(IDS.tempLow).val;

    if (power > 10 && tempMorgen < 5) {
        notifyR2('+++ ❄️ R2Mäh2 muss in den Keller. Es wird zu kalt! +++', 2);
        sendTo("sayit", "say", { text: 'Errzwomähzwoo muss in den Keller. Es wird zu kalt.' });
    }
});

// --- 2. STATUS-ÜBERWACHUNG ---
on({ id: IDS.power, change: 'ne' }, (obj) => {
    if (!isSaison()) return;
    const watt = obj.state.val;
    const oldWatt = obj.oldState.val;
    const zeitFenster = compareTime('10:00', '18:01', 'between');

    if (zeitFenster && watt < 4 && oldWatt >= 4 && !maeht) {
        maeht = true;
        setState(IDS.userMaeht, true, true);
        notifyR2('+++ 😓 🚜 R2Mäh2 mäht +++');
    } 
    else if (zeitFenster && watt > 10 && oldWatt <= 10 && maeht) {
        maeht = false;
        setState(IDS.userMaeht, false, true);
        notifyR2('+++ 🔌 🚜 R2Mäh2 wird geladen +++');
    }
});

// --- 3. DURCHSCHNITT ---
schedule("59 23 * * *", () => {
    if (!isSaison()) return;
    let liste = getState(IDS.userListe).val;
    if (!Array.isArray(liste)) liste = [0, 0, 0, 0, 0, 0, 0];

    liste.unshift(getState(IDS.today).val);
    if (liste.length > 7) liste.pop();
    
    setState(IDS.userListe, liste, true);
    const summe = liste.reduce((a, b) => a + b, 0);
    const mittel = (summe / liste.length).toFixed(2);
    setState(IDS.userMittel, mittel, true);
});