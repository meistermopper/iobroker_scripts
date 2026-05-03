/**
 * Name:   R2Maeh2 Maehroboter-Steuerung (Master)
 * Zweck:  Status, Frostwarnung, Durchschnitt & Steckdosen-Check
 * Stand:  01.03.2026 - Version mit Start-Sync & Debug-Log
 * Stand:  07.04.2026 - Einführung der Sprachansagen
 */

const WARTEZEIT_RESUME_MS = 8000; // Zeit bis Musik nach Ansage weiterläuft

const IDS = {
    power: 'alias.0.draussen.r2maeh2.ENERGY_Power',
    socket_state: 'alias.0.draussen.r2maeh2.POWER',
    today: 'alias.0.draussen.r2maeh2.ENERGY_Today',
    tempLow: 'pirate-weather.0.weather.daily.01.temperatureLow',
    userMaeht: '0_userdata.0.Energie.R2Mäh2.mäht',
    userListe: '0_userdata.0.Energie.R2Mäh2.Liste_Durchschnitt',
    userMittel: '0_userdata.0.Energie.R2Mäh2.Durchschnitt',
    userMittelKosten: '0_userdata.0.Energie.R2Mäh2.Durchschnittskosten',
    price: '0_userdata.0.Energie.Strompreise.akt_Preis',
    gotify: '0_userdata.0.gotifytoken.iobroker'
};

// --- NEU: INITIALISIERUNG ---
// Erzeugt alle benötigten Datenpunkte automatisch, falls sie fehlen
async function initDP() {
    const states = [
        { id: IDS.userMaeht, val: false, type: 'boolean', name: 'R2Mäh2 mäh-Status' },
        { id: IDS.userListe, val: [0, 0, 0, 0, 0, 0, 0], type: 'array', name: 'Historie der letzten 7 Tage' },
        { id: IDS.userMittel, val: 0, type: 'number', name: 'Durchschnittsverbrauch 7 Tage' },
        { id: IDS.userMittelKosten, val: '0,00', type: 'string', name: 'Durchschnittskosten pro Tag' },
        { id: IDS.price, val: 0.35, type: 'number', name: 'Aktueller Strompreis' }
    ];

    for (const s of states) {
        if (!existsState(s.id)) {
            await createStateAsync(s.id, s.val, {
                name: s.name,
                type: s.type,
                role: s.id === IDS.userMittelKosten ? 'text' : 'state'
            });
            console.log(`[R2Maeh2] Datenpunkt ${s.id} wurde neu angelegt.`);
        }
    }
}

initDP(); // Ausführen der Initialisierung

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

/**
 * --- GOOGLE-ANSAGE FUNKTION ---
 * Sucht alle aktiven Chromecasts, pausiert sie, macht die Ansage
 * und setzt die Musik (falls vorher laufend) fort.
 */
async function googleWatchdogAnnounce(text, vol) {
    const players = $(`chromecast.0.*.status.playerState`);

    players.each(async function(id) {
        const base = id.split('.status.')[0];
        const isPlaying = (getState(id).val === 'playing');

        let oldVol, oldUrl;

        // Aktuellen Status sichern, um ihn später wiederherzustellen
        if (isPlaying) {
            oldVol = getState(base + '.player.volume').val;
            oldUrl = getState(base + '.player.url2play').val;
        }

        // Ansage über die SayIt-Instanz triggern
        sendTo("sayit", "say", { text: text, volume: vol });

        // Musik nach der Wartezeit fortsetzen (Resume)
        if (isPlaying) {
            setStateDelayed(base + '.player.url2play', oldUrl, WARTEZEIT_RESUME_MS, false);
            setStateDelayed(base + '.player.volume', oldVol, WARTEZEIT_RESUME_MS + 500, false);
        }
    });
}

// --- 1. STECKDOSEN-UEBERWACHUNG ---
on({ id: IDS.socket_state, change: 'ne' }, function (obj) {
    if (obj.state.val === false) {
        notifyR2('❌ Die Steckdose von R2Maeh2 wurde ausgeschaltet!', 2);
    }
});

// --- 2. FROST-CHECK ---
schedule("1 18 * * *", async function () {
    if (!isSaison()) return;
    var pState = getState(IDS.power);
    var tState = getState(IDS.tempLow);
    if (pState && tState && pState.val > 10 && tState.val < 5) {
        notifyR2('+++ ❄️ R2Maeh2 muss in den Keller. Es wird zu kalt! +++', 2);

        if (compareTime('08:00', '20:00', 'between')) {
            await googleWatchdogAnnounce("Achtung, es wird zu kalt für Erzwo mäh zwo. Bitte bringe ihn in den Keller.", 40);
        }
    }
});

// --- 3. STATUS-UEBERWACHUNG (MIT DEBUG-LOG) ---
on({ id: IDS.power, change: 'ne' }, async function (obj) {
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

        if (compareTime('08:00', '20:00', 'between')) {
            await googleWatchdogAnnounce("ErzwoMähzwo ist fleißig", 40);
        }
    }
    // LOGIK: Mäher kehrt zurück
    // Wenn Watt über 10 steigt (Ladevorgang startet)
    else if (zeitFenster && watt > 10 && oldWatt <= 10 && maeht) {
        maeht = false;
        setState(IDS.userMaeht, false, true);
        notifyR2('+++ 🔌 R2Maeh2 ist zurück und wird geladen +++');

        if (compareTime('08:00', '20:00', 'between')) {
            await googleWatchdogAnnounce("ErzwoMähzwo wird geladen", 40);
        }
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
    var mittel = parseFloat((summe / (liste.length || 1)).toFixed(2));
    setState(IDS.userMittel, mittel, true);

    // NEU: Kostenberechnung am Ende des Tages
    var preis = getState(IDS.price).val || 0;
    var mittelKosten = (mittel * preis).toFixed(2).replace('.', ',');
    setState(IDS.userMittelKosten, mittelKosten, true);
});

// NEU: Sofortige Aktualisierung der Kosten bei Preisänderung
on({ id: IDS.price, change: 'ne' }, function (obj) {
    var mittel = getState(IDS.userMittel).val || 0;
    var mittelKosten = (mittel * (obj.state.val || 0)).toFixed(2).replace('.', ',');
    setState(IDS.userMittelKosten, mittelKosten, true);
});
