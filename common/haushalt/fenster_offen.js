// --- KONFIGURATION ---
const WARTEZEIT_MS = 1800000; // 30 Minuten in Millisekunden
const TEMP_LIMIT = 6;         // Meldung nur, wenn Außentemperatur unter X Grad
const POSTKASTEN_SN = '0000DA499F3C4A';
const AUSSENTEMPERATUR_ID = 'alias.0.draussen.thermometer.ACTUAL_TEMPERATURE';
// ----------------------

const timeouts = {};

// Trigger auf alle STATE-Datenpunkte der Instanz hm-rpc.1
on({ id: /^hm-rpc\.1\..*\.1\.STATE$/, change: 'ne' }, async (obj) => {
    const id = obj.id;
    const status = obj.state.val; // true = offen / false = geschlossen
    const nameRaw = obj.common ? obj.common.name : id;
    
    // 1. Postkasten ignorieren
    if (id.includes(POSTKASTEN_SN)) return;

    // 2. Logik bei Öffnung
    if (status === true || status === 1) {
        const aktuelleTemp = getState(AUSSENTEMPERATUR_ID).val;

        // Prüfung: Ist es draußen kalt genug für eine Warnung?
        if (aktuelleTemp < TEMP_LIMIT) {
            
            // Falls bereits ein Timer läuft (z.B. durch kurzes Schließen/Öffnen), löschen
            if (timeouts[id]) clearTimeout(timeouts[id]);

            //console.log(`Timer gestartet für: ${nameRaw} (Draußen: ${aktuelleTemp}°C)`);

            timeouts[id] = setTimeout(async () => {
                
                // Name aufbereiten (8 Zeichen am Ende entfernen)
                let nameKlartext = nameRaw.substring(0, nameRaw.length - 8);
                
                // Artikel dynamisch bestimmen
                let artikel = 'Das';
                if (nameKlartext.includes('Terrassentuer')) {
                    artikel = 'Die';
                } else if (nameKlartext.includes('Fenster')) {
                    artikel = 'Das';
                }

                const meldung = `${nameKlartext} steht seit 30 Minuten offen und sollte geschlossen werden. Die Außentemperatur beträgt ${aktuelleTemp} Grad Celsius.`;
                const volltext = `${artikel} ${meldung}`;

                // Versand & Ausgabe
                sendTo('telegram', 'send', { text: volltext });
                sendTo("sayit", "say", { text: meldung });
                console.warn(`Lüftungswarnung gesendet: ${volltext}`);
                
                delete timeouts[id];
            }, WARTEZEIT_MS); 
        }
    } 
    // 3. Logik bei Schließung
    else {
        if (timeouts[id]) {
            clearTimeout(timeouts[id]);
            delete timeouts[id];
            //console.log(`Timer für ${nameRaw} gelöscht, da geschlossen.`);
        }
    }
});