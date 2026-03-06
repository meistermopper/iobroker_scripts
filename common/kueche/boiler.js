// --- KONFIGURATION ---
const ID_BOILER = 'alias.0.kueche.boiler.POWER';
const ID_AUSSERHAUS = '0_userdata.0.Heizen.Programme.Ausserhaus';

let reaktivierungsTimer = null;

// --- ZEITPLAN: NORMALBETRIEB ---

// Einschalten morgens (falls jemand zu Hause ist)
schedule("0 5 * * *", () => {
    if (!getState(ID_AUSSERHAUS).val) {
        setState(ID_BOILER, true);
        //console.log("Boiler: Regelmäßiges Einschalten um 05:00 Uhr.");
    }
});

// Ausschalten abends
schedule("0 21 * * *", () => {
    setState(ID_BOILER, false);
    //console.log("Boiler: Regelmäßige Abschaltung um 21:00 Uhr.");
});

// --- ÜBERWACHUNG: ANTI-SELBSTABSCHALTUNG ---

on({ id: ID_BOILER, change: 'ne' }, (obj) => {
    const boilerSollteAnSein = compareTime('05:00', '21:00', 'between');
    const istAusserhaus = getState(ID_AUSSERHAUS).val;
    const wurdeAusgeschaltet = obj.state.val === false;

    // Nur reagieren, wenn er zwischen 5 und 21 Uhr AUS geht, obwohl jemand zu Hause ist
    if (wurdeAusgeschaltet && boilerSollteAnSein && !istAusserhaus) {
        
        // Falls bereits ein Reaktivierungs-Versuch läuft: abbrechen
        if (reaktivierungsTimer) clearTimeout(reaktivierungsTimer);

        console.warn("Boiler: Unerwartete Abschaltung erkannt! Reaktivierung in 2 Sekunden...");

        reaktivierungsTimer = setTimeout(() => {
            setState(ID_BOILER, true);
            
            sendTo("telegram", "send", {
                text: '🔄 Boiler-Schutz: Das Gerät hatte sich abgeschaltet und wurde automatisch reaktiviert.'
            });
            
            reaktivierungsTimer = null;
        }, 2000); // 2 Sekunden Pause statt 300ms (schont das Relais)
    }
});