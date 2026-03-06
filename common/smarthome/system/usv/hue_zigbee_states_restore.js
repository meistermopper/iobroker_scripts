/**
 * SKRIPT: USV Power-Restore Manager (V2026)
 * * ZWECK:
 * Sichert bei Stromausfall (USV-Betrieb) den Zustand von Lampen/Steckdosen
 * und stellt diesen bei Netzrückkehr exakt wieder her.
 * * LOGIK-UPGRADES:
 * - Dynamisches Delay: Verhindert Funkstau (Mesh-Flooding) durch gestaffeltes Schalten.
 * - Fehlertoleranz: Ignoriert nicht erreichbare Geräte beim Snapshot.
 * - Benachrichtigung: Informiert dich über Telegram/Gotify (falls konfiguriert).
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
    // USV Status (True = Strom weg / Batteriebetrieb)
    idUPS: 'nut.0.status.onbattery',
    
    // Speicherort für den Snapshot (als JSON-String)
    idStore: '0_userdata.0.Licht.Hue.Lampenstatus',
    
    // Welche Geräte sollen gesichert werden?
    selector: 'state[id=hue.0.*.on], state[id=zigbee.0.*.state]',
    
    // Schalt-Verzögerung in ms (Abstand zwischen zwei Schaltbefehlen)
    // Erhöhe diesen Wert auf 200, wenn dein Zigbee-Netzwerk träge reagiert.
    staggerDelay: 150,
    
    // Benachrichtigungen (nutzt deine vorhandenen Einstellungen)
    useNotifications: true
};

// --- 2. KERN-LOGIK ---

/**
 * Funktion: processPowerRestore
 * Wird gerufen, wenn der Strom wieder da ist.
 */
async function processPowerRestore() {
    try {
        const storeVal = getState(CONFIG.idStore).val;
        
        // Prüfung: Gibt es überhaupt einen gesicherten Zustand?
        if (!storeVal || storeVal === "{}" || storeVal === "[]") {
            console.log("USV-Restore: Kein Snapshot vorhanden oder Speicher leer.");
            return;
        }

        const lastStates = JSON.parse(storeVal);
        let delayCounter = 0; // Zähler für die Zeitstaffelung
        let restoreCount = 0;

        console.warn("USV: Netzbetrieb erkannt! Starte Wiederherstellung...");

        for (const id in lastStates) {
            const savedVal = lastStates[id];
            
            // Falls das Gerät im ioBroker existiert...
            if (existsState(id)) {
                const currentVal = getState(id).val;

                // Nur schalten, wenn der aktuelle Zustand vom gesicherten abweicht.
                // Das schont die Funk-Bandbreite enorm!
                if (savedVal !== currentVal) {
                    restoreCount++;
                    
                    /**
                     * WICHTIG: Staggered Delay (Gestaffelte Verzögerung)
                     * Wir erhöhen das Delay für jedes Gerät (0ms, 150ms, 300ms, 450ms...).
                     * Dadurch wird das Funknetz (Zigbee/Hue) nicht mit Befehlen geflutet.
                     */
                    const finalDelay = delayCounter * CONFIG.staggerDelay;
                    
                    setStateDelayed(id, savedVal, finalDelay);
                    delayCounter++;
                }
            }
        }

        // Nach der Wiederherstellung den Speicher leeren.
        setState(CONFIG.idStore, "{}", true);
        console.log(`USV-Restore: ${restoreCount} Geräte wurden zeitversetzt geschaltet.`);
        
        if (CONFIG.useNotifications) {
            sendNotification(`⚡ Netzstrom zurück! ${restoreCount} Lampen/Geräte wurden wiederhergestellt.`);
        }

    } catch (e) {
        console.error("USV-Restore: Fehler beim Wiederherstellen: " + e);
    }
}

/**
 * Funktion: createSnapshot
 * Sichert alle aktuellen Zustände in den Datenpunkt.
 */
function createSnapshot() {
    const statusSnapshot = {};
    const geraete = $(CONFIG.selector);

    console.warn("USV: Stromausfall! Erstelle Snapshot der Geräte...");

    geraete.each(id => {
        const state = getState(id);
        if (state && state.val !== null) {
            statusSnapshot[id] = state.val;
        }
    });

    // Speichere das Objekt als JSON-Text.
    setState(CONFIG.idStore, JSON.stringify(statusSnapshot), true);
    
    const count = Object.keys(statusSnapshot).length;
    console.log(`USV-Snapshot: ${count} Zustände erfolgreich gesichert.`);
    
    if (CONFIG.useNotifications) {
        sendNotification(`🔋 Stromausfall! USV übernimmt. ${count} Gerätestati wurden gesichert.`);
    }
}

/**
 * Funktion: sendNotification (Platzhalter für deine Bot-Logik)
 */
function sendNotification(msg) {
    // Hier kannst du deine Telegram/Gotify-Befehle einfügen
    console.log("Meldung: " + msg);
    // sendTo('telegram', { text: msg });
}

// --- 3. EVENT-TRIGGER ---

// Beobachtet den USV-Status auf Änderungen
on({ id: CONFIG.idUPS, change: "ne" }, async (obj) => {
    // Konvertiere Wert sicher zu Boolean (Strom weg = true)
    const onBattery = !!obj.state.val;

    if (onBattery) {
        // FALL 1: Stromausfall -> Sichern
        createSnapshot();
    } else {
        // FALL 2: Strom zurück -> Wiederherstellen
        // Wir warten 2 Sekunden, bis sich die Router/Gateways nach Stromrückkehr stabilisiert haben.
        setTimeout(processPowerRestore, 2000);
    }
});