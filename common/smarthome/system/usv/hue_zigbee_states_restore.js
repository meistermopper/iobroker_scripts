// --- KONFIGURATION ---
const ID_UPS_BATTERY = 'nut.0.status.onbattery';
const ID_STORE = '0_userdata.0.Licht.Hue.Lampenstatus';

// Hier definieren wir, welche Geräte überwacht werden:
// hue.0.*.on -> Alle Hue Lampen
// zigbee.0.*.state -> Alle Zigbee Lampen & Plugs (Steckdosen)
const SELECTOR = 'state[id=hue.0.*.on], state[id=zigbee.0.*.state]';

// --- LOGIK ---

on({ id: ID_UPS_BATTERY, change: "ne" }, async (obj) => {
    const onBattery = !!obj.state.val;

    if (onBattery) {
        // --- STROMAUSFALL: SNAPSHOT ERSTELLEN ---
        console.warn("USV: Stromausfall! Sicherung der Vitrine, Lampen und Plugs...");
        
        let statusSnapshot = {};
        let geraete = $(SELECTOR);

        geraete.each(function(id) {
            statusSnapshot[id] = getState(id).val;
        });

        setState(ID_STORE, JSON.stringify(statusSnapshot), true);
        console.log(`Snapshot erstellt: ${geraete.length} Zustände gesichert.`);

    } else {
        // --- STROM WIEDER DA: RESTAURIEREN ---
        console.warn("USV: Netzbetrieb! Stelle Zustände wieder her...");
        
        try {
            let storeVal = getState(ID_STORE).val;
            if (!storeVal || storeVal === "{}" || storeVal === "[]") return;

            let lastStates = JSON.parse(storeVal);

            for (let id in lastStates) {
                let sollStatus = lastStates[id];
                let aktuellerStatus = getState(id).val;

                // Nur schalten, wenn der Wert abweicht (schont das Funknetz)
                if (sollStatus !== aktuellerStatus) {
                    // Kurze Verzögerung beim Schalten, um Zigbee-Mesh nicht zu fluten
                    setStateDelayed(id, sollStatus, 100); 
                }
            }
            
            // Speicher leeren
            setState(ID_STORE, "{}", true);
            console.log("Wiederherstellung der Vitrine und Beleuchtung abgeschlossen.");

        } catch (e) {
            console.error("Fehler bei Power-Restore: " + e);
        }
    }
});