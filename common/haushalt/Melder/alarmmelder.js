/**
 * Name:   Gefahren-Melder (Rauch & Wasser)
 * Zweck:  Sofortige Alarmierung über alle Kanäle mit Anti-Spam-Schutz
 */

// --- KONFIGURATION DER SENSOREN ---
const ALARM_SENSOREN = {
    'alias.0.vorkeller.serverschrank.smoke': { msg: 'Rauch im Serverschrank!', icon: '🔥🔥🔥', type: 'smoke' },
    'alias.0.waschen.smoke':            { msg: 'Rauch in der Waschküche!', icon: '🔥🔥🔥', type: 'smoke' },
    'alias.0.heizung.detected':         { msg: 'Wasser im Heizungskeller!', icon: '🌊🌊🌊', type: 'water' },
    'alias.0.waschen.detected':         { msg: 'Wasser in der Waschküche!', icon: '🌊🌊🌊', type: 'water' },
    'alias.0.kueche.geschirr.detected': { msg: 'Wasser unterm Geschirrspüler!', icon: '🌊🌊🌊', type: 'water' },
    'alias.0.kueche.boiler.detected':   { msg: 'Wasser unter der Spüle!', icon: '🌊🌊🌊', type: 'water' }
};

const SPERRE_DAUER = 120000; // 2 Minuten Sperrzeit pro Sensor
let sperreAktiv = {};

// --- ALARM-FUNKTION ---
async function sendeAlarm(id) {
    const sensor = ALARM_SENSOREN[id];
    if (!sensor || sperreAktiv[id]) return;

    // Sperre für diesen Sensor setzen
    sperreAktiv[id] = true;
    setTimeout(() => { sperreAktiv[id] = false; }, SPERRE_DAUER);

    const telegramText = `${sensor.icon} +++ Alarm! ${sensor.msg} +++ ${sensor.icon}`;
    const sprachText = `Alarm! Alarm! ${sensor.msg}`;

    // Globale Benachrichtigung mit hoher Priorität und Sprachausgabe
    await sendGlobalNotify(telegramText, `GEFAHR: ${sensor.type.toUpperCase()}`, 8, 60);

    // 4. Loggen
    console.warn(`ALARM AUSGELÖST: ${telegramText}`);
}

// --- TRIGGER ---
console.log(`Gefahren-Melder: Überwachung von ${Object.keys(ALARM_SENSOREN).length} Sensoren gestartet.`);

on({ id: Object.keys(ALARM_SENSOREN), val: true, change: 'ne' }, async (obj) => {
    await sendeAlarm(obj.id);
});
