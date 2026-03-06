/**
 * =============================================================================
 * FENSTER-MONITOR v2.2 (Lüftungswarnung & Nachtruhe)
 * =============================================================================
 * ZWECK: Überwacht Fenster/Türen und warnt bei Kälte, wenn zu lange offen.
 * SONDERFALL: Dunstabzug in der Küche unterdrückt die Warnung.
 * NACHTRUHE: Sprachausgabe (SayIt) nur zwischen 08:00 und 20:00 Uhr.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const WARTEZEIT_MS = 1800000; // 30 Minuten (Verzögerung bis zur Meldung)
const TEMP_LIMIT = 6;         // Warnung nur aktiv, wenn Außentemp < 6 Grad
const POSTKASTEN_SN = '0000DA499F3C4A'; // Seriennummer des Briefkastens (ignorieren)
const AUSSENTEMPERATUR_ID = 'alias.0.draussen.thermometer.ACTUAL_TEMPERATURE';

// Dunstabzug-Sonderfall (Küche)
const KUECHE_FENSTER_ID = 'hm-rpc.1.0000DA498D6099'; 
const DUNSTABZUG_POWER_ID = 'alias.0.kueche.dunstabzug.ENERGY_Power';
const DUNSTABZUG_THRESHOLD = 17; // Watt (Grenze für "An")

const timeouts = {}; // Speicher für laufende Timer

// --- 2. HAUPT-LOGIK (Trigger auf alle hm-rpc.1 Sensoren) ---
on({ id: /^hm-rpc\.1\..*\.1\.STATE$/, change: 'ne' }, async (obj) => {
    const id = obj.id;
    const status = obj.state.val; // true = offen / false = geschlossen
    const nameRaw = obj.common ? obj.common.name : id;
    
    // 1. Postkasten-Sensor ignorieren
    if (id.includes(POSTKASTEN_SN)) return;

    // 2. LOGIK BEI ÖFFNUNG
    if (status === true || status === 1) {
        const aktuelleTemp = getState(AUSSENTEMPERATUR_ID).val;

        // Prüfung: Ist es draußen kalt genug für eine Warnung?
        if (aktuelleTemp < TEMP_LIMIT) {
            // Alten Timer löschen, falls vorhanden (Sicherheit)
            if (timeouts[id]) clearTimeout(timeouts[id]);

            // Timer starten
            timeouts[id] = setTimeout(async () => {
                
                // --- PRÜFUNG SONDERFALL KÜCHE ---
                // Falls das Küchenfenster triggert, prüfen wir den Dunstabzug
                if (id.includes(KUECHE_FENSTER_ID)) {
                    const essePower = getState(DUNSTABZUG_POWER_ID).val;
                    
                    if (essePower > DUNSTABZUG_THRESHOLD) {
                        console.log(`[Fenster] Küche offen, aber Dunstabzug läuft (${essePower}W). Warnung unterdrückt.`);
                        delete timeouts[id];
                        return; // Abbruch: Keine Meldung, da gekocht wird
                    }
                }
                // -------------------------------

                // Textbausteine für die Meldung generieren
                let nameKlartext = nameRaw.substring(0, nameRaw.length - 8);
                let artikel = 'Das';
                if (nameKlartext.includes('Terrassentuer')) {
                    artikel = 'Die';
                } else if (nameKlartext.includes('Fenster')) {
                    artikel = 'Das';
                }

                const meldung = `${nameKlartext} steht seit 30 Minuten offen und sollte geschlossen werden. Die Außentemperatur beträgt ${aktuelleTemp} Grad Celsius.`;
                const volltext = `${artikel} ${meldung}`;

                // --- BENACHRICHTIGUNG ---
                
                // A) Telegram (Immer senden)
                sendTo('telegram', 'send', { text: volltext });

                // B) SayIt (NUR zwischen 08:00 und 20:00 Uhr)
                if (compareTime('08:00', '20:00', 'between')) {
                    sendTo("sayit", "say", { text: meldung });
                    console.log(`[Fenster] Sprachausgabe gesendet: ${nameKlartext}`);
                } else {
                    console.log(`[Fenster] Sprachausgabe unterdrückt (Nachtzeit): ${nameKlartext}`);
                }

                console.warn(`Lüftungswarnung gesendet: ${volltext}`);
                
                delete timeouts[id]; // Timer-Referenz nach Ausführung löschen
            }, WARTEZEIT_MS); 
        }
    } 
    // 3. LOGIK BEI SCHLIESSUNG
    else {
        // Falls das Fenster geschlossen wird, bevor die Zeit abgelaufen ist: Timer löschen
        if (timeouts[id]) {
            clearTimeout(timeouts[id]);
            delete timeouts[id];
            //console.log(`[Fenster] ${nameRaw} wurde rechtzeitig geschlossen. Timer gelöscht.`);
        }
    }
});