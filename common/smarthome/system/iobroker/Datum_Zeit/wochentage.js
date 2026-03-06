// Skriptname: Wochentage_Berechnen

// Funktion zum Ermitteln und Setzen der nächsten 7 Wochentage
function setNextSevenWeekdays() {
    
    // Optionen für die Formatierung des Wochentagsnamens (Deutsch, langer Name)
    // Die 'de-DE' Lokalisierung ist entscheidend für die deutschen Namen
    const formatOptions = { weekday: 'long' }; 

    // Schleife von i=0 (Heute) bis i=6 (in 6 Tagen)
    for (let i = 0; i < 7; i++) {
        
        // 1. Datumsobjekt erstellen
        const date = new Date();
        
        // 2. Tage zum Datum hinzufügen
        // .setDate() wird verwendet, um i Tage zum heutigen Datum hinzuzufügen.
        date.setDate(date.getDate() + i); 
        
        // 3. Wochentagsnamen im deutschen Format ermitteln
        // .toLocaleString() ist die moderne, sprachunabhängige Methode.
        const dayName = date.toLocaleString('de-DE', formatOptions);
        
        // 4. Datenpunkt-ID dynamisch zusammenbauen
        // Erzeugt "0_userdata.0.Wochentage.Tag_0", "_1", etc.
        const dpId = `0_userdata.0.Wochentage.Tag_${i}`;
        
        // 5. Wert in den ioBroker Datenpunkt schreiben
        // console.log(`Schreibe "${dayName}" in DP: ${dpId}`); // Optional zum Testen
        setState(dpId, dayName, true); 
        
    }
    //log("Wochentage erfolgreich aktualisiert.");
}

// ----------------------------------------------------------------------------------
// Ausführung des Skripts
// ----------------------------------------------------------------------------------

// 1. Führe die Funktion sofort einmal aus, wenn das Skript startet
setNextSevenWeekdays();

// 2. Führe die Funktion täglich um 00:05 Uhr erneut aus, um die Werte zu aktualisieren
// Das ist wichtig, damit "Tag_0" immer der aktuelle Wochentag ist.
schedule('5 0 * * *', setNextSevenWeekdays);