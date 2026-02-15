const suncalc = require('suncalc');
const dp_mond_zunehmend = '0_userdata.0.Zeiten.Mondphase'; // Ihr gewünschter Datenpunkt-Pfad

// =========================================================================
// Datenpunkt erstellen (wird nur beim ersten Start/Speichern ausgeführt)
// 'true' = Zunehmender Mond
// 'false' = Abnehmender Mond
// =========================================================================
createState(dp_mond_zunehmend, false, {
    type: 'boolean',
    name: 'Mondphase: Zunehmend (true) oder Abnehmend (false)',
    read: true,
    write: false,
    role: 'indicator.moonphase'
});


// =========================================================================
// Funktion zur Ermittlung der Mondphase
// =========================================================================
function checkMoonPhase() {
    const mond = suncalc.getMoonIllumination(new Date());
    const phase = mond.phase; // Dezimalwert zwischen 0.0 (Neumond) und 1.0 (Neumond)

    // Logik:
    // 0.0 - 0.5 ist Zunehmend (einschließlich Neumond bis Vollmond)
    // 0.5 - 1.0 ist Abnehmend (einschließlich Vollmond bis Neumond)
    
    // Um Rundungsfehler oder den genauen Moment des Vollmonds (0.5) abzufangen, 
    // verwenden wir eine einfache Prüfung:
    
    let istZunehmend = false;
    
    if (phase > 0.0 && phase < 0.5) {
        // Zwischen Neumond (0.0) und Vollmond (0.5)
        istZunehmend = true; 
    } else if (phase > 0.5 && phase < 1.0) {
        // Zwischen Vollmond (0.5) und Neumond (1.0)
        istZunehmend = false;
    } else if (phase === 0.0 || phase === 1.0) {
        // Neumond: Kann als "Start des zunehmenden Zyklus" gewertet werden
        istZunehmend = true; 
    } else if (phase === 0.5) {
        // Vollmond: Kann als "Ende des zunehmenden Zyklus" gewertet werden
        istZunehmend = false;
    }
    
    // Setze den Wert des Boolean-Datenpunkts
    setState(dp_mond_zunehmend, istZunehmend, true);
    
    //log('Aktuelle Mondphase (Phase: ' + phase + '): Zunehmend = ' + istZunehmend);
}


// =========================================================================
// Skriptausführung
// =========================================================================

// Skript beim Start einmal ausführen
checkMoonPhase();

// Regelmäßige Ausführung: Einmal täglich um 00:05 Uhr 
// (oder ein anderes Intervall, je nach Bedarf)
schedule('5 0 * * *', checkMoonPhase);