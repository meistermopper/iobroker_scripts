/**
 * =============================================================================
 * SKRIPT: Intelligente Navigations-Ansage "Ziegenhain"
 * =============================================================================
 * ZWECK:
 * Dieses Skript reagiert auf einen Sprach-Trigger ("Hey google, fahr zur Hölle!").
 * Es berechnet, auf welchem Google-Gerät der Befehl gegeben wurde, und gibt nur dort
 * die humorvolle Bestätigung aus.
 *
 * LOGIK:
 * Da Google/ioBroker standardmäßig nicht mitteilen, welches Gerät einen Befehl
 * empfangen hat, nutzen wir einen "Zeitstempel-Fingerabdruck": Das Gerät, dessen
 * Status (playerState) zuletzt aktualisiert wurde, ist das Gerät, mit dem der
 * Benutzer gerade spricht.
 * =============================================================================
 */

// Der Datenpunkt, der als Auslöser dient (wird meist von Google Cloud/IoT gesteuert)
const ID_TRIGGER = '0_userdata.0.Sonstige.Trigger.Ziegenhain';
let ziegenhainTimer = null; // Speicher für den Timer, um Mehrfach-Trigger abzufangen

/**
 * Findet die SayIt-Instanz des Google-Geräts, das zuletzt aktiv war.
 * Nutzt den Zeitstempel (ts) der Chromecast-Status-Datenpunkte.
 */
async function getActiveSayItInstance() {
    let bestInstance = 'sayit.0'; // Standard-Fallback
    let latestTs = 0; // Speicher für den bisher neuesten Zeitstempel

    // Wir suchen mit dem Selektor alle Konfigurations-Objekte der SayIt-Instanzen
    const instances = $('system.adapter.sayit.*');

    for (const id of instances) {
        // Wir filtern nur die Haupt-Objekte (z.B. system.adapter.sayit.0)
        if (id.match(/^system\.adapter\.sayit\.\d+$/)) {
            // Wir laden die Konfiguration der Instanz, um zu sehen, welches Gerät ihr zugeordnet ist
            const obj = await getObjectAsync(id);
            const chromecastPath = obj?.native?.device; // Enthält z.B. "chromecast.0.Wohnzimmer"

            // Prüfen, ob ein Gerät hinterlegt ist und ob der Status-Datenpunkt existiert
            if (chromecastPath && existsState(chromecastPath + '.status.playerState')) {
                // Wir holen den Zeitstempel (.ts) der letzten Änderung.
                // Wenn man "Hey Google" sagt, ändert sich dieser Wert kurzzeitig (Ducking/Status-Update).
                const ts = getState(chromecastPath + '.status.playerState').ts;

                // Vergleich: Ist dieser Zeitstempel neuer als der bisher gefundene?
                if (ts > latestTs) {
                    latestTs = ts;
                    // Wir merken uns die Instanz-ID (z.B. "sayit.2")
                    bestInstance = id.replace('system.adapter.', '');
                }
            }
        }
    }
    return bestInstance; // Rückgabe der "gewinnenden" Instanz
}

/**
 * TRIGGER-LOGIK
 * Reagiert, wenn der Datenpunkt auf 'true' gesetzt wird ("Hey google, fahr zur Hölle!").
 */
on({ id: ID_TRIGGER, val: true, change: 'any' }, async (obj) => {

    /**
     * FALLSTRICK: RACE CONDITION & PRELLEN
     * Falls der Trigger extrem schnell hintereinander ausgelöst wird (oder Google den Befehl doppelt sendet),
     * löschen wir einen eventuell laufenden Timer, bevor wir einen neuen starten.
     * Das stellt sicher, dass die Ansage nur EINMAL nach der letzten Änderung erfolgt.
     */
    if (ziegenhainTimer) clearTimeout(ziegenhainTimer);

    /**
     * TIMING-STRATEGIE (3000ms):
     * Wir warten 3 Sekunden. Das ist wichtig, damit der Chromecast-Adapter Zeit hat,
     * die Statusänderung von der Google-Cloud zu empfangen und in ioBroker zu schreiben.
     * Ohne diese Pause würden wir eventuell einen alten Zeitstempel vergleichen.
     */
    ziegenhainTimer = setTimeout(async () => {
        // 1. Analysieren, welches Zimmer/Gerät zuletzt "gehört" hat
        const targetInstance = await getActiveSayItInstance();

        // 2. Sprachausgabe nur an das ermittelte Ziel senden
        sendTo(targetInstance, "say", {
            text: 'Okay, die Route zu den Lattch-Köppen nach Ziegenhain wird berechnet!'
        });

        // 3. Den Trigger-Datenpunkt wieder auf 'false' setzen.
        // Das 'ack: true' (Bestätigt) verhindert, dass der Trigger erneut gefeuert wird.
        setState(ID_TRIGGER, false, true);

        // Dokumentation im Log zur Erfolgskontrolle
        log(`Navigation: Route nach Ziegenhain wird über ${targetInstance} ausgegeben.`);

        ziegenhainTimer = null; // Timer-Variable wieder freigeben
    }, 3000);
});
