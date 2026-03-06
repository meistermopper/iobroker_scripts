/**
 * =============================================================================
 * REINIGUNGS-SKRIPT V2.1 (SANDBOX-MODUS)
 * =============================================================================
 * ZWECK: 
 * Findet und löscht alle Objekte unter dem fehlerhaften Pfad mithilfe des
 * Standard-Selektors ($), um den "getForeignObjects" Fehler zu umgehen.
 * =============================================================================
 */

async function sandboxCleanup() {
    // Der Selektor $(...) sucht nach allen IDs, die mit diesem Pfad beginnen.
    // Das '*' fungiert als Wildcard für alle Unterordner und Datenpunkte.
    const pattern = '0_userdata.0.Energie.PV.Prognose*';
    
    console.log("[Cleaner] Suche nach Objekten: " + pattern);

    // Wir holen uns alle IDs als Array
    const foundIds = $(pattern);
    
    if (foundIds.length === 0) {
        console.log("[Cleaner] Keine Objekte gefunden. Die Datenbank scheint bereits sauber zu sein.");
        return;
    }

    console.log(`[Cleaner] ${foundIds.length} Objekte gefunden. Starte Löschung...`);

    // Wir gehen jede gefundene ID einzeln durch
    foundIds.each(function(id) {
        try {
            // deleteObject löscht das Objekt aus der Datenbank
            deleteObject(id);
            console.log("[Cleaner] Gelöscht: " + id);
        } catch (e) {
            console.error("[Cleaner] Fehler beim Löschen von " + id + ": " + e);
        }
    });
    
    console.log("[Cleaner] Vorgang beendet. Bitte Admin-Seite neu laden.");
}

// Skript-Ausführung starten
sandboxCleanup();