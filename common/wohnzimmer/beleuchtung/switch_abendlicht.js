/**
 * Name:   Abendlicht Wohnzimmer Master (V6 - Hardware-Safe)
 * Fix:    CT-Werte exakt auf Objekt-Limits (2000-6536 K) begrenzt
 */

const ID_TRIGGER = '0_userdata.0.Licht.Wohnzimmer.Abendlicht';
const ALIAS_KOMMODE = 'alias.0.wohnzimmer.licht.kommode.command'; 
const ALIAS_EI      = 'alias.0.wohnzimmer.licht.ei.command';      

// --- WERTE-KONFIGURATION (Kelvin laut deinem Objekt: 2000 - 6536) ---
const START_BRI_KOMMODE = 40;
const START_BRI_EI      = 60;
const START_CT_EI       = 2525; // Warmweiß (OK)

const END_BRI_KOMMODE   = 20; 
const END_BRI_EI        = 20; 
const END_CT_EI         = 2000; // Untergrenze (OK)

const START_FADE_IN_SEC = 50; 
const TRANSITION_DURATION = 27000; 

let transitionSchedule = null;

// Hilfsfunktion: Hält Werte EXAKT in deinen Hardware-Grenzen
function limit(val, min, max) {
    return Math.min(Math.max(Math.round(val), min), max);
}

on({ id: ID_TRIGGER, change: "ne", ack: false }, (obj) => {
    const sollAn = !!obj.state.val;
    
    if (transitionSchedule) {
        clearSchedule(transitionSchedule);
        transitionSchedule = null;
    }

    if (sollAn) {
        //console.log(`[Abendlicht] Einschalten: Start-Sequenz läuft...`);

        const fadeInKommode = JSON.stringify({ 
            "on": true, 
            "level": limit(START_BRI_KOMMODE, 0, 100), 
            "transitiontime": limit(START_FADE_IN_SEC, 0, 65535) 
        });

        const fadeInEi = JSON.stringify({ 
            "on": true, 
            "level": limit(START_BRI_EI, 0, 100), 
            "ct": limit(START_CT_EI, 2000, 6536), // Max auf 6536 korrigiert
            "transitiontime": limit(START_FADE_IN_SEC, 0, 65535) 
        });
        
        setState(ALIAS_KOMMODE, fadeInKommode);
        setTimeout(() => setState(ALIAS_EI, fadeInEi), 1500);

        transitionSchedule = schedule("30 22 * * *", () => {
            console.log(`[Abendlicht] 22:30 Uhr: Sanfter Übergang startet...`);
            
            setState(ALIAS_KOMMODE, JSON.stringify({
                "level": limit(END_BRI_KOMMODE, 0, 100),
                "transitiontime": limit(TRANSITION_DURATION, 0, 65535)
            }));

            setTimeout(() => {
                setState(ALIAS_EI, JSON.stringify({
                    "level": limit(END_BRI_EI, 0, 100),
                    "ct": limit(END_CT_EI, 2000, 6536), 
                    "transitiontime": limit(TRANSITION_DURATION, 0, 65535)
                }));
            }, 1500);
        });

    } else {
        //console.log(`[Abendlicht] Ausschalten.`);
        const off = JSON.stringify({ "on": false, "transitiontime": 20 });
        setState(ALIAS_KOMMODE, off);
        setTimeout(() => setState(ALIAS_EI, off), 1500);
    }
});