// --- KONFIGURATION ---
const WARTEZEIT_MS = 1800000; // 30 Minuten
const TEMP_LIMIT = 6;         // Meldung nur unter X Grad
const POSTKASTEN_SN = '0000DA499F3C4A';
const AUSSENTEMPERATUR_ID = 'alias.0.draussen.thermometer.ACTUAL_TEMPERATURE';

// Dunstabzug-Sonderfall
const KUECHE_FENSTER_ID = 'hm-rpc.1.0000DA498D6099'; // Deine neue Sensor-ID
const DUNSTABZUG_POWER_ID = 'alias.0.kueche.dunstabzug.ENERGY_Power';
const DUNSTABZUG_THRESHOLD = 17; // Watt
// ----------------------

const timeouts = {};

on({ id: /^hm-rpc\.1\..*\.1\.STATE$/, change: 'ne' }, async (obj) => {
    const id = obj.id;
    const status = obj.state.val; // true = offen / false = geschlossen
    const nameRaw = obj.common ? obj.common.name : id;
    
    // 1. Postkasten ignorieren
    if (id.includes(POSTKASTEN_SN)) return;

    // 2. Logik bei Öffnung
    if (status === true || status === 1) {
        const aktuelleTemp = getState(AUSSENTEMPERATUR_ID).val;

        if (aktuelleTemp < TEMP_LIMIT) {
            if (timeouts[id]) clearTimeout(timeouts[id]);

            timeouts[id] = setTimeout(async () => {
                
                // --- PRÜFUNG SONDERFALL KÜCHE ---
                // Wir prüfen, ob die ID des triggernden Geräts zum Küchenfenster gehört
                if (id.includes(KUECHE_FENSTER_ID)) {
                    const essePower = getState(DUNSTABZUG_POWER_ID).val;
                    
                    if (essePower > DUNSTABZUG_THRESHOLD) {
                        console.log(`[Fenster] Küche offen, aber Dunstabzug läuft (${essePower}W). Warnung unterdrückt.`);
                        delete timeouts[id];
                        return; // Skript bricht hier ab, keine Meldung
                    }
                }
                // -------------------------------

                let nameKlartext = nameRaw.substring(0, nameRaw.length - 8);
                let artikel = 'Das';
                if (nameKlartext.includes('Terrassentuer')) {
                    artikel = 'Die';
                } else if (nameKlartext.includes('Fenster')) {
                    artikel = 'Das';
                }

                const meldung = `${nameKlartext} steht seit 30 Minuten offen und sollte geschlossen werden. Die Außentemperatur beträgt ${aktuelleTemp} Grad Celsius.`;
                const volltext = `${artikel} ${meldung}`;

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
        }
    }
});