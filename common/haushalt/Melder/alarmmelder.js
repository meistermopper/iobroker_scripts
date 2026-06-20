/**
 * Name:   Gefahren-Melder (Rauch & Wasser)
 * Zweck:  Sofortige Alarmierung über alle Kanäle mit Anti-Spam-Schutz
 */

// --- KONFIGURATION DER SENSOREN ---
// Ein Mapping der ioBroker State-IDs auf deren jeweilige Alarmdetails (Nachricht, Icon und Gefahrentyp).
const ALARM_SENSOREN = {
    'alias.0.vorkeller.serverschrank.smoke': { msg: 'Rauch im Serverschrank!', icon: '🔥🔥🔥', type: 'smoke' },
    'alias.0.waschen.smoke':            { msg: 'Rauch in der Waschküche!', icon: '🔥🔥🔥', type: 'smoke' },
    'alias.0.heizung.detected':         { msg: 'Wasser im Heizungskeller!', icon: '🌊🌊🌊', type: 'water' },
    'alias.0.waschen.detected':         { msg: 'Wasser in der Waschküche!', icon: '🌊🌊🌊', type: 'water' },
    'alias.0.kueche.geschirr.detected': { msg: 'Wasser unterm Geschirrspüler!', icon: '🌊🌊🌊', type: 'water' },
    'alias.0.kueche.boiler.detected':   { msg: 'Wasser unter der Spüle!', icon: '🌊🌊🌊', type: 'water' }
};

// Sperrzeit pro Sensor in Millisekunden (120.000 ms = 2 Minuten).
// Verhindert, dass bei kontinuierlich feuerndem Sensor der Chat oder die Sprachausgabe überflutet wird.
const SPERRE_DAUER = 120000; 

// Dieses Objekt speichert die Zeitstempel der letzten Auslösung je Sensor.
// Beispiel: { 'alias.0.waschen.smoke': 1718900000000 }
const sperreAktiv = {};

// --- ALARM-FUNKTION ---
/**
 * Führt die eigentliche Alarmierung aus, falls der Sensor existiert und nicht gesperrt ist.
 * @param {string} id - Die ioBroker State-ID des ausgelösten Sensors.
 */
async function sendeAlarm(id) {
    const sensor = ALARM_SENSOREN[id];
    
    // Falls die ID nicht in unserer Konfiguration existiert, brechen wir ab.
    if (!sensor) return;

    const jetzt = Date.now();
    
    // Prüfen, ob die letzte Benachrichtigung für diesen Sensor weniger als 2 Minuten her ist.
    // Falls ja, brechen wir ab, um Spam zu vermeiden (Rate Limiting).
    if (sperreAktiv[id] && (jetzt - sperreAktiv[id] < SPERRE_DAUER)) {
        return;
    }

    // Zusammensetzen des Nachrichtentextes für Telegram/Gotify mit passenden Emojis
    const telegramText = `${sensor.icon} +++ Alarm! ${sensor.msg} +++ ${sensor.icon}`;

    try {
        // Zeitstempel der Sperre direkt vor dem Senden setzen.
        // So wird die Sperre auch dann aktiv gehalten, wenn der async-Aufruf etwas Zeit benötigt.
        sperreAktiv[id] = jetzt;

        // Globale Benachrichtigung ausführen.
        // Parameter: text, title, priority, voiceVol
        // - Priority: 8 (Kritischer Alarm für Gotify)
        // - VoiceVol: 60 (Löst Sprachausgabe über Google Speaker mit 60% Lautstärke aus)
        // Die Funktion filtert Emojis für die Sprachausgabe automatisch heraus.
        await sendGlobalNotify(telegramText, `GEFAHR: ${sensor.type.toUpperCase()}`, 8, 60);

        // Bestätigung im ioBroker-Protokoll loggen.
        // Wir loggen hier zusätzlich die konkrete State-ID, damit bei Problemen klar ist, welcher Alias gefeuert hat.
        console.warn(`ALARM AUSGELÖST: ${telegramText} (Sensor: ${id})`);

    } catch (error) {
        // Falls die Benachrichtigung fehlschlägt (z.B. wegen Netzwerkproblemen),
        // heben wir die Sperre sofort wieder auf, damit ein neuer Versuch beim nächsten Trigger stattfinden kann.
        delete sperreAktiv[id];
        console.error(`Fehler beim Senden des Alarms für ${id}: ${error.message || error}`);
    }
}

// --- TRIGGER ---
console.log(`Gefahren-Melder: Überwachung von ${Object.keys(ALARM_SENSOREN).length} Sensoren gestartet.`);

// ioBroker-Trigger: Reagiert auf alle IDs, die im Objekt ALARM_SENSOREN konfiguriert sind.
// - val: true      -> Triggert nur, wenn der Zustand wahr/aktiv ist (z.B. Rauch erkannt).
// - change: 'ne'   -> Triggert nur bei einer echten Zustandsänderung (not equal).
on({ id: Object.keys(ALARM_SENSOREN), val: true, change: 'ne' }, async (obj) => {
    await sendeAlarm(obj.id);
});
