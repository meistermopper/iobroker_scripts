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
on({ id: ID_TRIGGER, val: true, change: 'any' }, (obj) => {
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
    ziegenhainTimer = setTimeout(() => {
        const message = 'Okay, die Route nach Ziegenhain wird berechnet!';
        const defaultVolume = 50; // Standardlautstärke für die Ansage

        sendGlobalNotify(message, "Navigation", 1, defaultVolume);

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
