/**
 * SCRIPT: HEOS-Filter für den Chromecast-Adapter
 * -----------------------------------------------------------------------------
 * Problem: Der chromecast-Adapter v4.0.0 findet per mDNS ungefragt HEOS-Geräte.
 * Diese verursachen Socket-Fehler, da sie das Protokoll nicht voll unterstützen.
 * * Lösung: Dieses Skript löscht die unerwünschten Geräte-Instanzen automatisch,
 * sobald der Adapter sie anlegt.
 * -----------------------------------------------------------------------------
 */

// Liste deiner HEOS-Geräte, die NICHT im Chromecast-Adapter sein sollen.
// Die Namen müssen exakt so geschrieben sein, wie sie im Objektbaum erscheinen.
const heosDevices = [
    'HEOS Sauna',
    'Marantz CINEMA 60',
    'Heos5'
];

// Die Instanz des Adapters
const adapterInstance = 'chromecast.0';

/**
 * Funktion zum Löschen eines Geräts inklusive aller States.
 * @param {string} deviceName - Der Name des Geräts (wie im Adapter angezeigt)
 */
function deleteHeosDevice(deviceName) {
    // ioBroker wandelt Leerzeichen in IDs oft in Unterstriche um.
    // Wir bauen den Pfad zusammen: z.B. chromecast.0.HEOS_Sauna
    const deviceId = deviceName.replace(/\s+/g, '_');
    const fullPath = adapterInstance + '.' + deviceId;

    // Prüfen, ob das Objekt existiert
    if (existsObject(fullPath)) {
        log('Unerwünschtes HEOS-Gerät "' + deviceName + '" erkannt. Lösche Pfad: ' + fullPath, 'warn');

        // deleteDevice löscht den gesamten Ordner-Zweig rekursiv
        deleteDevice(fullPath, (err) => {
            if (err) {
                log('Fehler beim Löschen von ' + deviceName + ': ' + err, 'error');
            } else {
                log('Erfolgreich bereinigt: ' + deviceName, 'info');
            }
        });
    }
}

/**
 * TRIGGER: Wir überwachen den chromecast-Adapter auf neue States.
 * Wir reagieren auf den ".name" State, da dieser beim Discovery fast immer
 * als einer der ersten States befüllt wird.
 */
on({id: /^chromecast\.\d+\..*\.name$/, change: 'any'}, function (obj) {
    const detectedName = obj.state.val;

    // Prüfen, ob der neu gefundene Name in unserer Verbotsliste steht
    if (heosDevices.includes(detectedName)) {
        log('Filter-Alarm: ' + detectedName + ' wurde vom Adapter gefangen!', 'info');

        // Wir warten 5 Sekunden, damit der Adapter seinen Schreibvorgang
        // beenden kann, bevor wir ihm die Daten unterm Hintern wegwischen.
        // Das verhindert Schreib-Lösch-Konflikte.
        setTimeout(() => {
            deleteHeosDevice(detectedName);
        }, 5000);
    }
});

/**
 * INITIALISIERUNG:
 * Beim Skriptstart einmalig alle bekannten Problem-Geräte löschen.
 */
log('HEOS-Schutzschild für Chromecast-Adapter gestartet...', 'info');
heosDevices.forEach((name) => {
    deleteHeosDevice(name);
});
