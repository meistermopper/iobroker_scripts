/**
 * =============================================================================
 * R2Mäh2 ROBOTIC MOWER CONTROL (MASTER SCRIPT)
 * =============================================================================
 * PURPOSE:
 * - Monitors mower status via power consumption (Watts).
 * - Sends notifications for start, end, or issues (Telegram/Gotify).
 * - Performs voice announcements via Google Home (Chromecast).
 * - Calculates daily statistics and electricity costs.
 * - Frost warning: Reminds user to bring the mower inside during autumn.
 *
 * LOGIC:
 * - Mowing: Power drops below 4W (base station idle, mower gone).
 * - Charging: Power rises above 10W (mower docked and drawing current).
 * =============================================================================
 */

// --- CONFIGURATION & THRESHOLDS ---
const WARTEZEIT_RESUME_MS = 8000;         // Resume music after 8s
const MAX_MAEHZEIT_MS     = 150 * 60 * 1000; // 2h until "stuck" alarm
const THRESHOLD_IDLE      = 4;            // Under 4W: Station is empty (mower is out)
const THRESHOLD_CHARGING  = 10;           // Over 10W: Mower is actively charging
const VOL_ANNOUNCEMENT    = 40;           // Default volume for announcements

// --- DATA POINTS ---
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
};

let stuckTimer; // Globaler Timer-Handle für die Überwachung

async function initDP() {
    /**
     * INITIALISIERUNG
     * Erzeugt alle benötigten Datenpunkte automatisch beim ersten Start.
     * Dies macht das Skript portabel und verhindert Fehler durch fehlende IDs.
     */
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

initDP();

// Start-Synchronisation: Status aus dem Datenpunkt lesen
const maehtState = getState(IDS.userMaeht);
let maeht = !!(maehtState && maehtState.val);

console.log(`R2Maeh2: Skript gestartet. Aktueller Maeh-Status: ${maeht ? 'MAEHT' : 'BEREIT'}`);

function startStuckTimer() {
    /**
     * Überwachung: Liegen geblieben?
     * Wenn der Mäher länger als 120 Min. weg ist, wird Alarm geschlagen.
     */
    stopStuckTimer();
    stuckTimer = setTimeout(async () => {
        const msg = "Achtung: Erzwo mäh zwo mäht seit über 120 Minuten. Er ist vermutlich irgendwo liegen geblieben.";
        await sendGlobalNotify(`⚠️ ${msg}`, "R2Maeh2", 2, compareTime('08:00', '20:00', 'between') ? 45 : null); // Sprachausgabe nur tagsüber
    }, MAX_MAEHZEIT_MS); // 2 Stunden
}

/**
 * Stoppt die Überwachung
 */
function stopStuckTimer() {
    if (stuckTimer) {
        clearTimeout(stuckTimer);
        stuckTimer = null;
    }
}

// Falls das Skript während des Mähens neu gestartet wird, Timer wieder aktivieren
if (maeht) startStuckTimer();

function isSaison() {
    /**
     * Mähsaison-Check (März bis Oktober)
     */
    const monat = new Date().getMonth();
    return (monat >= 2 && monat <= 9);
}

// --- 1. STECKDOSEN-UEBERWACHUNG ---
on({ id: IDS.socket_state, change: 'ne' }, function (obj) {
    if (obj.state.val === false) {
        sendGlobalNotify('❌ Die Steckdose von ErrzwoMähzwo wurde ausgeschaltet!', "R2Maeh2", 2);
    }
});

// --- 2. FROST-CHECK ---
schedule("1 18 * * *", async function () {
    if (!isSaison()) return;
    const pState = getState(IDS.power);
    const tState = getState(IDS.tempLow);

    // Wenn der Strom an ist (Mäher draußen), aber Frost droht (< 5°C)
    if (pState && tState && pState.val > 10 && tState.val < 5) {
        await sendGlobalNotify(
            '❄️ ErrzwoMähzwo muss in den Keller. Es wird zu kalt!',
            "R2Maeh2",
            2,
            compareTime('08:00', '20:00', 'between') ? 40 : null
        );
    }
});

// --- 3. STATUS-UEBERWACHUNG (CORE LOGIK) ---
on({ id: IDS.power, change: 'ne' }, async function (obj) {
    if (!isSaison()) return;
    if (!obj.state) return;

    const watt = obj.state.val;
    const oldWatt = obj.oldState ? obj.oldState.val : 0;

    // Falls du manuell testest (ohne Bestätigt-Haken), entferne das '&& obj.state.ack'
    if (!obj.state.ack) return;

    // FALL 1: MÄHER FÄHRT LOS
    // Die Station geht in den Leerlauf (< 4W), da der Mäher die Kontakte verlassen hat.
    if (compareTime('10:00', '18:01', 'between') && watt < THRESHOLD_IDLE && oldWatt >= THRESHOLD_IDLE && !maeht) {
        maeht = true;
        setState(IDS.userMaeht, true, true);
        startStuckTimer();
        await sendGlobalNotify(
            '🚜 ErrzwoMähzwo ist fleißig',
            "R2Maeh2",
            1,
            compareTime('08:00', '20:00', 'between') ? 40 : null
        );
    }
    // FALL 2: MÄHER KEHRT ZURÜCK
    // Die Station erkennt den Mäher und startet den Ladevorgang (> 10W).
    // WICHTIG: Kein Zeitfenster bei Rückkehr, um den Status immer sauber zurückzusetzen!
    else if (watt > THRESHOLD_CHARGING && oldWatt <= THRESHOLD_CHARGING && maeht) {
        maeht = false;
        setState(IDS.userMaeht, false, true);
        stopStuckTimer();
        await sendGlobalNotify(
            '🔌 ErrzwoMähzwo wird geladen',
            "R2Maeh2",
            1,
            compareTime('08:00', '20:00', 'between') ? 40 : null
        );
    }
});

// --- 4. DURCHSCHNITT ---
schedule("59 23 * * *", function () {
    if (!isSaison()) return;

    const liste = (getState(IDS.userListe).val || [0, 0, 0, 0, 0, 0, 0]);
    const heute = (getState(IDS.today).val || 0);

    liste.unshift(heute);
    if (liste.length > 7) liste.pop();
    setState(IDS.userListe, liste, true);

    const summe = liste.reduce((a, b) => a + b, 0);
    const mittel = parseFloat((summe / (liste.length || 1)).toFixed(2));
    setState(IDS.userMittel, mittel, true);

    updateCosts(mittel, getState(IDS.price).val);
});

// NEU: Sofortige Aktualisierung der Kosten bei Preisänderung
on({ id: IDS.price, change: 'ne' }, (obj) => {
    updateCosts(getState(IDS.userMittel).val, obj.state.val);
});

function updateCosts(verbrauch, preis) {
    /**
     * Hilfsfunktion zur Kostenberechnung
     */
    const p = preis || 0.35;
    const v = verbrauch || 0;
    const mittelKosten = (v * p).toFixed(2).replace('.', ',');
    setState(IDS.userMittelKosten, mittelKosten, true);
}
