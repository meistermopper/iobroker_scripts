/**
 * =============================================================================
 * LICHTSTEUERUNG GARDEROBE (PRESENCE FOLLOWER)
 * =============================================================================
 * ZWECK: Das Licht folgt exakt dem Zustand des Präsenzmelders.
 * OPTIMIERUNG: 
 * 1. Schont den Bus/Funk: Befehle werden nur gesendet, wenn nötig.
 * 2. Status-Sync: Beim Start wird das Licht an den Ist-Zustand angepasst.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const ID_PRASENZ = 'alias.0.garderobe.bwm.PRESENCE_DETECTION_STATE';
const ID_LICHT   = 'alias.0.garderobe.licht.POWER';

/**
 * --- 2. INITIALISIERUNG BEIM SKRIPTSTART ---
 * Wir sorgen dafür, dass das Licht beim Start des Skripts sofort 
 * den korrekten Zustand einnimmt, basierend auf dem Melder.
 */
const aktuellerStatus = !!getState(ID_PRASENZ)?.val; // Aktuellen Sensorwert holen
const lichtStatus     = !!getState(ID_LICHT)?.val;   // Aktuellen Lichtwert holen

// Nur schalten, wenn der Ist-Zustand des Lichts nicht zum Melder passt
if (lichtStatus !== aktuellerStatus) {
    setState(ID_LICHT, aktuellerStatus);
    console.log(`Garderobe: Initial-Sync, Licht auf ${aktuellerStatus ? 'AN' : 'AUS'} gesetzt`);
}

/**
 * --- 3. EVENT-LOGIK ---
 * Der Trigger reagiert auf jede Statusänderung ('ne' = nicht egal) des Melders.
 */
on({ id: ID_PRASENZ, change: 'ne' }, (obj) => {
    
    // Konvertierung: Wir erzwingen einen echten Boolean-Wert (true/false)
    // Das verhindert Fehler, falls der Melder 1/0 oder "true"/"false" liefert.
    const istAnwesend = !!obj.state.val; 
    
    // Performance-Check: Wir prüfen erst den aktuellen Zustand der Lampe.
    // Warum? Wenn die Lampe schon AN ist und wir nochmal "AN" senden, 
    // erzeugt das unnötigen Funkverkehr auf deinem Netzwerk.
    const lichtIstAn = !!getState(ID_LICHT)?.val;

    if (istAnwesend && !lichtIstAn) {
        // Fall 1: Bewegung erkannt, aber Licht ist noch aus -> Einschalten
        setState(ID_LICHT, true);
        // console.log("Garderobe: Präsenz erkannt -> Licht AN");
        
    } else if (!istAnwesend && lichtIstAn) {
        // Fall 2: Keine Präsenz mehr, aber Licht brennt noch -> Ausschalten
        setState(ID_LICHT, false);
        // console.log("Garderobe: Keine Präsenz -> Licht AUS");
    }
    
    // Hinweis: Falls Präsenz erkannt wird UND das Licht schon an ist, 
    // passiert hier einfach gar nichts (genau so soll es sein).
});