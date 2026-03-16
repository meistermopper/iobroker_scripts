/**
 * SCRIPT: Chromecast-Filter (Anti-HEOS-Sauna)
 * -----------------------------------------------------------------------------
 * ZWECK:
 * Da der chromecast-Adapter (v4.0.0+) HEOS-Geräte fälschlicherweise per mDNS
 * erkennt und dadurch "socket"-Fehler im Log erzeugt, dient dieses Skript als
 * automatischer Filter. Sobald das Objekt 'HEOS_Sauna' angelegt wird, löscht
 * dieses Skript den Eintrag wieder.
 * * VORAUSSETZUNG:
 * Der JavaScript-Adapter muss installiert sein.
 * -----------------------------------------------------------------------------
 */

// Konfiguration: Der Pfad zum unerwünschten Gerät
// Bitte prüfe unter 'Objekte', ob der Ordner exakt so heißt.
const devicePath = 'chromecast.0.HEOS_Sauna';

let tRemove = null; // Timer-Variable für Debounce

/**
 * Funktion zum sauberen Löschen des Gerätes
 */
function removeHeosSauna() {
    // Wir prüfen zuerst, ob das Objekt überhaupt existiert
    if (existsObject(devicePath)) {
        log('HEOS Sauna wurde vom Chromecast-Adapter erkannt. Löschvorgang gestartet...', 'warn');

        // deleteObject mit {recursive: true} löscht den Ordner samt aller Unter-States
        deleteObject(devicePath, true, (err) => {
            if (err) {
                log('Fehler beim automatischen Löschen der HEOS Sauna: ' + err, 'error');
            } else {
                log('HEOS Sauna erfolgreich aus dem Chromecast-Zweig entfernt', 'info');
            }
        });
    }
}

/**
 * TRIGGER: Überwachung auf Neuerstellung
 * Wir nutzen jetzt einen RegEx, der auf JEDEN Datenpunkt unterhalb des Geräts reagiert.
 * Das ist viel sicherer als nur auf '.name' zu warten.
 */
on({ id: new RegExp('^' + devicePath.replace(/\./g, '\\.') + '\\..*'), change: "any" }, function (obj) {
    // Timer zurücksetzen, falls er schon läuft (verhindert Mehrfachausführung)
    if (tRemove) clearTimeout(tRemove);

    // Löschvorgang mit 2 Sekunden Verzögerung starten
    tRemove = setTimeout(removeHeosSauna, 2000);
});

/**
 * INITIALISIERUNG
 * Beim Start des Skripts prüfen wir einmalig, ob die "Leiche" noch da ist.
 */
log('Chromecast-Filter-Skript aktiv. Überwache: ' + devicePath, 'info');
removeHeosSauna();
