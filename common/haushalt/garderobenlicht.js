// --- KONFIGURATION ---
const ID_PRASENZ = 'alias.0.garderobe.bwm.PRESENCE_DETECTION_STATE';
const ID_LICHT = 'alias.0.garderobe.licht.POWER';

// --- INITIALISIERUNG ---
// Beim Skriptstart Licht ausschalten, falls es noch an ist (optional, wie in deinem Original)
if (getState(ID_LICHT).val) {
    setState(ID_LICHT, false);
}

// --- LOGIK ---
on({ id: ID_PRASENZ, change: 'ne' }, (obj) => {
    const istAnwesend = !!obj.state.val; // Konvertiert zu echtem Boolean (true/false)
    
    // Licht schalten (Zustand des Melders wird direkt übernommen)
    setState(ID_LICHT, istAnwesend);

    // Logging (Optional)
   // console.log(`Garderobe: Präsenz ${istAnwesend ? 'erkannt - Licht AN' : 'beendet - Licht AUS'}.`);
});