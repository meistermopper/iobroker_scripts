/**
 * =============================================================================
 * KÜCHEN-LICHTSTEUERUNG v2.0 (AUTOMATIK & NACHTMODUS)
 * =============================================================================
 * ZWECK: Intelligente Steuerung der Küchenbeleuchtung basierend auf Präsenz,
 * Helligkeit und Uhrzeit.
 * * OPTIMIERUNGEN:
 * 1. TRAFFIC-CHECK: Befehle werden nur gesendet, wenn der Status sich wirklich ändert.
 * 2. TIMING: 300ms Versatz zwischen Sonoff und Hue zur Entlastung des Funknetzes.
 * 3. NACHTMODUS: Automatisches Dimmen zwischen 22:00 und 05:00 Uhr.
 * =============================================================================
 */

// --- 1. KONFIGURATION (PFADE) ---
const IDS = {
    präsenz:      'alias.0.kueche.bwm.PRESENCE_DETECTION_STATE',
    helligkeit:   'alias.0.kueche.bwm.ILLUMINATION',
    automatik:    '0_userdata.0.Licht.Küche.Bewegungsautomatik',
    spots_sonoff: 'alias.0.kueche.licht.spots.POWER',
    hue_command:  'alias.0.kueche.kuechenlampe.command'
};

// --- PARAMETER ---
const LIMIT_LUX = 12;      // Schwellwert für "zu dunkel"
const BRI_TAG   = 254;     // Volle Helligkeit
const BRI_NACHT = 150;     // Gedimmtes Nachtlicht

let debounceTimer = null;

/**
 * --- 2. EVENT-LOGIK ---
 * Der Trigger reagiert auf den Präsenzmelder.
 */
on({ id: IDS.präsenz, change: 'ne' }, (obj) => {
    
    // Bestehenden Timer löschen (Entprellung), falls der Melder schnell flackert
    if (debounceTimer) clearTimeout(debounceTimer);

    // 50ms Verzögerung zur Stabilisierung der Werte (wie im ursprünglichen Blockly)
    debounceTimer = setTimeout(async () => {
        
        // --- STATUS-CHECK ---
        const bewegung       = !!obj.state.val;
        const helligkeit     = getState(IDS.helligkeit).val;
        const autoAktiv      = getState(IDS.automatik).val;
        const spotsSindAn    = getState(IDS.spots_sonoff).val;
        
        // Zeitprüfung: Nutzen der ioBroker-eigenen compareTime Funktion für 22:00 - 05:00 Uhr
        const istNacht = compareTime('22:00', '05:00', 'between');

        // FALL A: AUTOMATIK IST AUS -> Skript bricht sofort ab
        if (!autoAktiv) return;

        // FALL B: BEWEGUNG ERKANNT & ZU DUNKEL
        if (bewegung && helligkeit < LIMIT_LUX) {
            
            if (istNacht) {
                /**
                 * --- NACHT-MODUS ---
                 * Nur die Hue-Lampe geht gedimmt an. Die Sonoff-Spots bleiben aus,
                 * um nachts nicht zu blenden.
                 */
                const cmdNacht = JSON.stringify({ "on": true, "bri": BRI_NACHT, "transitiontime": 10 });
                
                // Nur senden, wenn die Lampe nicht schon exakt so eingestellt ist
                if (getState(IDS.hue_command).val !== cmdNacht) {
                    setState(IDS.hue_command, cmdNacht);
                }
                
            } else {
                /**
                 * --- TAG-MODUS ---
                 * Erst die Sonoff-Spots (per Relais), dann die Hue-Lampe (per Funk).
                 * Der Versatz von 300ms verhindert Funk-Kollisionen.
                 */
                if (!spotsSindAn) {
                    setState(IDS.spots_sonoff, true);
                }

                setTimeout(() => {
                    const cmdTag = JSON.stringify({ "on": true, "bri": BRI_TAG, "transitiontime": 10 });
                    if (getState(IDS.hue_command).val !== cmdTag) {
                        setState(IDS.hue_command, cmdTag);
                    }
                }, 300);
            }

        } 
        
        // FALL C: KEINE BEWEGUNG MEHR -> LICHT AUS
        else if (!bewegung) {
            
            /**
             * Wir schalten beide Kreise aus. 
             * Auch hier nutzen wir den 300ms Versatz zur Netz-Schonung.
             */
            if (spotsSindAn) {
                setState(IDS.spots_sonoff, false);
            }

            setTimeout(() => {
                const cmdAus = JSON.stringify({ "on": false, "transitiontime": 10 });
                // Nur senden, wenn die Lampe noch als "AN" gemeldet ist
                setState(IDS.hue_command, cmdAus);
            }, 300);
        }

    }, 50);
});