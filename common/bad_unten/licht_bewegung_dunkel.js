// --- Konfiguration ---
const ID_BWM         = 'alias.0.bad_unten.bwm.occupancy';
const ID_TUER        = 'alias.0.bad_unten.tuer.opened';
const ID_LUX         = 'alias.0.bad_unten.bwm.illuminance_raw';
const ID_BWM_ENABLE  = '0_userdata.0.Licht.Bad_unten.BWM';

const HUE_ON         = 'alias.0.bad_unten.licht.spiegel.on';
const HUE_LEVEL      = 'alias.0.bad_unten.licht.spiegel.level';
const HUE_BRI        = 'alias.0.bad_unten.licht.spiegel.bri';
const HUE_CT         = 'alias.0.bad_unten.licht.spiegel.ct';
const SONOFF_PWR     = 'alias.0.bad_unten.licht.spots.POWER';

let timeoutAusschalten = null;
let timeoutVorwarnung  = null;
let timeoutGedenkpause = null;

function istArbeitstag() {
    const d = new Date().getDay();
    return (d >= 1 && d <= 5);
}

async function lichtAn() {
    const jetzt = new Date();
    let bri = 30;
    let ct = 2700;
    let sonoffAn = false;

    // Zeitsteuerung Logik (wie gehabt)
    if (istArbeitstag() && compareTime('05:00', '10:00', 'between')) {
        bri = 100; ct = 6494; sonoffAn = true;
    } 
    else if (!istArbeitstag() && compareTime('07:00', '10:00', 'between')) {
        bri = 100; ct = 6494; sonoffAn = true;
    }
    else if (compareTime('10:00', '21:00', 'between')) {
        sonoffAn = true;
        bri = 0; 
    }

    // Aktuelle Werte setzen
    if (bri > 0) {
        setState(HUE_LEVEL, 31);
        setStateDelayed(HUE_BRI, bri, 50, false);
        setStateDelayed(HUE_CT, ct, 50, false);
    }
    if (sonoffAn) setState(SONOFF_PWR, true);

    // Bestehende Timer löschen
    if (timeoutAusschalten) clearTimeout(timeoutAusschalten);
    if (timeoutVorwarnung) clearTimeout(timeoutVorwarnung);

    // VORWARNUNG: Nach 25 Minuten kurz auf 10% dimmen
    timeoutVorwarnung = setTimeout(() => {
        if (getState(HUE_ON).val) { // Nur wenn das Licht noch an ist
            const alterBri = getState(HUE_BRI).val;
            setState(HUE_BRI, 10); // Kurz dunkel machen
            //console.log("[Bad Unten] Vorwarnung: Dimme auf 10%");
            
            // Nach 5 Sekunden wieder auf den vorherigen Wert zurück (falls keine neue Bewegung kam)
            setTimeout(() => {
                if (timeoutAusschalten) setState(HUE_BRI, alterBri);
            }, 5000);
        }
    }, 1500000); // 25 Minuten

    // AUSSCHALTEN: Nach 30 Minuten
    timeoutAusschalten = setTimeout(() => {
        lichtAus();
    }, 1800000); 
}

function lichtAus() {
    setState(HUE_ON, false);
    setState(SONOFF_PWR, false);
    if (timeoutAusschalten) { clearTimeout(timeoutAusschalten); timeoutAusschalten = null; }
    if (timeoutVorwarnung) { clearTimeout(timeoutVorwarnung); timeoutVorwarnung = null; }
    //console.log("[Bad Unten] Licht komplett aus");
}

// --- Trigger ---

on({ id: ID_BWM, change: 'any' }, (obj) => {
    if (timeoutGedenkpause) clearTimeout(timeoutGedenkpause);

    timeoutGedenkpause = setTimeout(() => {
        const occupancy = !!obj.state.val;
        const istDunkel = getState(ID_LUX).val <= 15;
        const bwmAktiv = getState(ID_BWM_ENABLE).val;

        // Wenn Bewegung erkannt wird, Licht an oder Timer verlängern
        if (occupancy && istDunkel && bwmAktiv) {
            lichtAn();
        }
    }, 50); // Der 50ms Hardware-Delay
});

on({ id: ID_TUER, change: 'gt' }, () => {
    lichtAus();
});