/**
 * SCRIPT: Chromecast Cleaner & HEOS-Filter
 * -----------------------------------------------------------------------------
 * Problem: Der chromecast-Adapter v4.0.0+ erzeugt oft Geister-Einträge:
 * 1. HEOS-Geräte, die Socket-Fehler verursachen.
 * 2. Einträge mit dem Zusatz "(unvollständig)", die Ansagen (SayIt) blockieren.
 * * Lösung: Dieses Skript überwacht den Adapter und löscht diese Problemfälle
 * automatisch, sobald sie auftauchen oder beim Skriptstart vorhanden sind.
 * -----------------------------------------------------------------------------
 */

// Liste der explizit unerwünschten Geräte-Namen (z.B. HEOS)
const bannedDeviceNames = [
    'HEOS Sauna',
    'Marantz CINEMA 60',
    'Heos5'
];

// Liste der IDs, die auf jeden Fall ignoriert werden sollen
const bannedDeviceIds = [
    '0005cd77e0a8', // Marantz CINEMA 60
    '000678ef039d'  // HEOS Sauna
];

// Die Instanz des Adapters
const adapterInstance = 'chromecast.0';

/**
 * Kernfunktion zum Löschen eines fehlerhaften Geräts
 * @param {string} devicePath - Der vollständige ioBroker-Pfad (z.B. chromecast.0.xyz)
 * @param {string} reason - Grund der Löschung für das Log
 */
function cleanUpDevice(devicePath, reason) {
    if (existsObject(devicePath)) {
        log('Bereinigung: Pfad "' + devicePath + '" wird gelöscht. Grund: ' + reason, 'warn');

        // deleteObject mit recursive=true löscht den gesamten Zweig zuverlässig
        deleteObject(devicePath, true, (err) => {
            if (err) {
                log('Fehler beim Löschen von ' + devicePath + ': ' + err, 'error');
            } else {
                log('Erfolgreich gelöscht: ' + devicePath, 'info');
            }
        });
    }
}

/**
 * Funktion, die einen Namen prüft und bei Bedarf die Löschung einleitet
 * @param {string} name - Der Anzeigename des Geräts
 * @param {string} fullId - Die vollständige ID des States
 */
function checkAndFilter(name, fullId) {
    if (!name || typeof name !== 'string') return;

    // Wir extrahieren den Gerätepfad aus der State-ID
    // (von "chromecast.0.id.name" zu "chromecast.0.id")
    const parts = fullId.split('.');
    if (parts.length < 3) return;
    const devicePath = parts[0] + '.' + parts[1] + '.' + parts[2];
    const deviceId = parts[2];

    let shouldDelete = false;
    let reason = '';

    // Prüfung 1: Ist die ID in der Verbotsliste?
    if (bannedDeviceIds.includes(deviceId)) {
        shouldDelete = true;
        reason = `Geräte-ID '${deviceId}' steht auf der schwarzen Liste`;
    }

    // Prüfung 2: Ist es in der HEOS-Verbotsliste (Name)?
    const cleanName = name.trim();
    if (!shouldDelete && bannedDeviceNames.includes(cleanName)) {
        shouldDelete = true;
        reason = 'Gerät steht auf der Verbotsliste (HEOS-Filter)';
    }

    // Prüfung 3: Ist der Eintrag als unvollständig markiert?
    if (!shouldDelete && name.includes('(unvollständig)')) {
        shouldDelete = true;
        reason = 'Unvollständiger Eintrag erkannt (Chromecast-Fehler)';
    }

    if (shouldDelete) {
        // Wir warten kurz, um dem Adapter Zeit für interne Prozesse zu lassen
        setTimeout(() => {
            cleanUpDevice(devicePath, reason);
        }, 5000);
    }
}

/**
 * TRIGGER: Überwachung auf neue oder geänderte Gerätenamen
 */
on({id: new RegExp('^' + adapterInstance.replace('.', '\\.') + '\\..*\\.name$'), change: 'any'}, function (obj) {
    checkAndFilter(obj.state.val, obj.id);
});

/**
 * INITIALISIERUNG:
 * Beim Skriptstart suchen wir einmalig alle vorhandenen Namen durch.
 */
log('Chromecast-Cleaner & HEOS-Schutzschild aktiv', 'info');

// Alle ".name" Zustände der Instanz abfragen
const currentNames = $(adapterInstance + '.*.name');
currentNames.each(function(id) {
    const val = getState(id).val;
    checkAndFilter(val, id);
});
