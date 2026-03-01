/**
 * Name:   R2Maeh2 Maehroboter-Steuerung (Master)
 * Zweck:  Status, Frostwarnung, Durchschnitt & Steckdosen-Check
 * Stand:  01.03.2026 - Version mit Start-Sync & Debug-Log
 */

const IDS = {
    power: 'alias.0.draussen.r2maeh2.ENERGY_Power',
    socket_state: 'alias.0.draussen.r2maeh2.POWER',
    today: 'alias.0.draussen.r2maeh2.ENERGY_Today',
    tempLow: 'pirate-weather.0.weather.daily.01.temperatureLow',
    userMaeht: '0_userdata.0.Energie.R2Mäh2.mäht',
    userListe: '0_userdata.0.Energie.R2Mäh2.Liste_Durchschnitt',
    userMittel: '0_userdata.0.Energie.R2Mäh2.Durchschnitt',
    gotify: '0_userdata.0.gotifytoken.iobroker'
};

// --- NEU: INITIALISIERUNG ---
// Wir laden beim Start den echten Zustand aus dem Datenpunkt, 
// damit das Skript weiß, ob er gerade schon mäht oder nicht.
var maehtState = getState(IDS.userMaeht);
var maeht = (maehtState && maehtState.val === true) ? true : false;

console.log('R2Maeh2: Skript gestartet. Aktueller Maeh-Status: ' + (maeht ? 'MAEHT' : 'BEREIT'));

function isSaison() {
    var monat = new Date().getMonth(); 
    return (monat >= 2 && monat <= 8); 
}

function notifyR2(text, priority) {
    var p = priority || 1;
    sendTo('telegram', 'send', { text: text });
    console.log('R2Maeh2-Meldung: ' + text);
    
    var gState = getState(IDS.gotify);
    if (gState && gState.val) {
        var command = 'curl "https://mygotify.meistermopper.de/message?token=' + gState.val + '" ';
        command += '-F "title=ioBroker: R2Maeh2" ';
        command += '-F "message=' + text + '" ';
        command += '-F "priority=' + p + '"';
        exec(command);
    }
}

// --- 1. STECKDOSEN-UEBERWACHUNG ---
on({ id: IDS.socket_state, change: 'ne' }, function (obj) {
    if (obj.state.val === false) {
        notifyR2('❌ Die Steckdose von R2Maeh2 wurde ausgeschaltet!', 2);
    }
});

// --- 2. FROST-CHECK ---
schedule("1 18 * * *", function () {
    if (!isSaison()) return;
    var pState = getState(IDS.power);
    var tState = getState(IDS.tempLow);
    if (pState && tState && pState.val > 10 && tState.val < 5) {
        notifyR2('+++ ❄️ R2Maeh2 muss in den Keller. Es wird zu kalt! +++', 2);
    }
});

// --- 3. STATUS-UEBERWACHUNG (MIT DEBUG-LOG) ---
on({ id: IDS.power, change: 'ne' }, function (obj) {
    if (!isSaison()) return;
    
    var watt = obj.state.val;
    var oldWatt = obj.oldState ? obj.oldState.val : 0;
    var zeitFenster = compareTime('10:00', '18:01', 'between');

    // DEBUG: Wir schreiben jeden Watt-Wechsel kurz ins Log, um die Werte zu sehen
    // (Kannst du später löschen, wenn alles läuft)
    console.debug('R2Maeh2 Watt-Check: Aktuell ' + watt + 'W (vorher ' + oldWatt + 'W). Fenster: ' + zeitFenster + ', Status: ' + maeht);

    // LOGIK: Mäher fährt los
    // Wenn Watt unter 4 sinkt und vorher höher war (Station wird fast stromlos)
    if (zeitFenster && watt < 4 && oldWatt >= 4 && !maeht) {
        maeht = true;
        setState(IDS.userMaeht, true, true);
        notifyR2('+++ 🚜 R2Maeh2 hat mit dem Mähen losgelegt +++');
    } 
    // LOGIK: Mäher kehrt zurück
    // Wenn Watt über 10 steigt (Ladevorgang startet)
    else if (zeitFenster && watt > 10 && oldWatt <= 10 && maeht) {
        maeht = false;
        setState(IDS.userMaeht, false, true);
        notifyR2('+++ 🔌 R2Maeh2 ist zurück und wird geladen +++');
    }
});

// --- 4. DURCHSCHNITT ---
schedule("59 23 * * *", function () {
    if (!isSaison()) return;
    var lState = getState(IDS.userListe);
    var liste = (lState && Array.isArray(lState.val)) ? lState.val : [0, 0, 0, 0, 0, 0, 0];
    var tState = getState(IDS.today);
    liste.unshift(tState ? tState.val : 0);
    if (liste.length > 7) liste.pop();
    setState(IDS.userListe, liste, true);
    var summe = 0;
    for (var i = 0; i < liste.length; i++) { summe += liste[i]; }
    var mittel = (summe / (liste.length || 1)).toFixed(2);
    setState(IDS.userMittel, mittel, true);
});