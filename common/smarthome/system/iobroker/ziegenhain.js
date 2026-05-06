/**
 * =============================================================================
 * SKRIPT: Navigations-Ansage "Ziegenhain" (Broadcast-Version)
 * =============================================================================
 * ZWECK:
 * Dieses Skript reagiert auf einen speziellen Sprach-Trigger ("Hey google, fahr zur Hölle!").
 * Es gibt auf ALLEN aktiven SayIt-Instanzen im Haus eine humorvolle Bestätigung aus.
 *
 * FUNKTIONSWEISE:
 * Sobald der Trigger-Datenpunkt aktiviert wird, wartet das Skript kurz (Entprellung),
 * sucht dann alle installierten SayIt-Adapter-Instanzen und sendet den Text an
 * jede Instanz, die aktuell als "erreichbar" (alive) markiert ist.
 * =============================================================================
 */

// Der Datenpunkt, der als Auslöser dient (wird meist von Google Cloud/IoT gesteuert)
const ID_TRIGGER = '0_userdata.0.Sonstige.Trigger.Ziegenhain';
let ziegenhainTimer = null; // Speicher für den Timer, um Mehrfach-Trigger abzufangen

/**
 * TRIGGER-LOGIK
 * Reagiert, wenn der Datenpunkt auf 'true' gesetzt wird.
 */
on({ id: ID_TRIGGER, val: true, change: 'any' }, async (obj) => {
    /**
     * SCHUTZ VOR DOPPEL-TRIGGER (Entprellen):
     * Falls der Befehl von Google doppelt gesendet wird oder der Datenpunkt
     * extrem schnell flackert, löschen wir den alten Timer, falls noch einer läuft.
     * So wird die Aktion erst nach Ablauf der Zeit nach dem LETZTEN Impuls ausgeführt.
     */
    if (ziegenhainTimer) clearTimeout(ziegenhainTimer);

    /**
     * VERZÖGERUNG (3000ms):
     * Wir warten 3 Sekunden. Das gibt dem System Zeit, sich zu beruhigen,
     * bevor die Sprachausgabe auf allen Lautsprechern startet.
     */
    ziegenhainTimer = setTimeout(async () => {
        const message = 'Okay, die Route zu den Lattch-Köppen nach Ziegenhain wird berechnet!';

        /**
         * DYNAMISCHE SUCHE DER AUSGABEGERÄTE:
         * Der Selektor $('system.adapter.sayit.*') findet alle Objekte im Systembaum,
         * die zum SayIt-Adapter gehören.
         */
        const instances = $('system.adapter.sayit.*');

        for (const id of instances) {
            /**
             * FILTERUNG:
             * Wir suchen gezielt nach den Haupt-Instanz-Objekten (z.B. system.adapter.sayit.0).
             * Die Regex stellt sicher, dass wir keine Unterpunkte wie ".alive" direkt in der Schleife verarbeiten.
             */
            if (id.match(/^system\.adapter\.sayit\.\d+$/)) {

                // Wir extrahieren den technischen Namen der Instanz (z.B. "sayit.0")
                const sayitInstance = id.replace('system.adapter.', '');

                /**
                 * ERREICHBARKEITS-CHECK:
                 * Wir prüfen über das ".alive"-Flag, ob der jeweilige Adapter-Prozess überhaupt läuft.
                 * Das verhindert Fehlerversuche bei deaktivierten Instanzen.
                 */
                if (existsState(`${id}.alive`) && getState(`${id}.alive`).val) {
                    // Den Text-zu-Sprache Befehl an die Instanz senden
                    sendTo(sayitInstance, "say", {
                        text: message
                    });
                    log(`Navigation: Route nach Ziegenhain wird über ${sayitInstance} ausgegeben`);
                } else {
                    log(`Navigation: SayIt-Instanz ${sayitInstance} ist nicht aktiv, überspringe.`);
                }
            }
        }

        /**
         * TRIGGER ZURÜCKSETZEN:
         * Wir setzen den Datenpunkt wieder auf 'false'.
         * Das 'ack: true' (Acknowledge) signalisiert dem System, dass der Wert
         * vom Skript bestätigt/verarbeitet wurde.
         */
        setState(ID_TRIGGER, false, true);

        ziegenhainTimer = null; // Variable für den nächsten Durchlauf freigeben
    }, 3000);
});
