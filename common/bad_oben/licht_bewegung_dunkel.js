// --- Konfiguration ---
const ID_BWM         = 'alias.0.bad_oben.bwm.occupancy';
const ID_LUX         = 'alias.0.bad_oben.bwm.illuminance_raw';
const ID_BWM_ENABLE  = '0_userdata.0.Licht.Bad_oben.BWM';
const ID_TUER        = 'alias.0.bad_oben.tuer.opened';
const ID_LICHT       = 'alias.0.bad_oben.licht.POWER';

let timerAusschalten = null;
let timerBwmVerzoegerung = null;
let timerVorwarnung = null;

// Funktion zum Einschalten
async function lichtAn() {
    setState(ID_LICHT, true);
    
    // Alle laufenden Timer stoppen
    if (timerAusschalten) clearTimeout(timerAusschalten);
    if (timerVorwarnung) clearTimeout(timerVorwarnung);

    // Vorwarnung nach 25 Minuten (Licht kurz aus/an)
    timerVorwarnung = setTimeout(() => {
        setState(ID_LICHT, false);
        setTimeout(() => setState(ID_LICHT, true), 500); // Nach 0,5 Sek wieder an
        //console.log("[Bad Oben] Vorwarnung gesendet");
    }, 1500000); // 25 Minuten

    // Endgültiges Ausschalten nach 30 Minuten
    timerAusschalten = setTimeout(() => {
        setState(ID_LICHT, false);
        //console.log("[Bad Oben] Automatisch ausgeschaltet");
    }, 1800000); // 30 Minuten
}

// --- Trigger ---

on({ id: ID_BWM, change: 'any' }, (obj) => {
    if (timerBwmVerzoegerung) clearTimeout(timerBwmVerzoegerung);

    timerBwmVerzoegerung = setTimeout(() => {
        const occupancy = !!obj.state.val;
        const istDunkel = getState(ID_LUX).val <= 15;
        const bwmAktiv  = getState(ID_BWM_ENABLE).val;

        if (occupancy && istDunkel && bwmAktiv) {
            lichtAn();
        }
    }, 50); // Der gewünschte 50ms Delay für die Hardware
});

on({ id: ID_TUER, change: 'gt' }, () => {
    if (timerAusschalten) clearTimeout(timerAusschalten);
    if (timerVorwarnung) clearTimeout(timerVorwarnung);
    setState(ID_LICHT, false);
});