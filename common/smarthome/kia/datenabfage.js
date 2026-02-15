/*******************************************************
 * Kia Datenabfrage & Standort - Korrigierte Version
 *******************************************************/

let timeout_kia = null;

// 1. Täglich den Zähler auf 0 zurücksetzen
schedule("0 0 * * *", async () => {
    setState('0_userdata.0.Energie.Kia_e_niro.Anz_Aktualisierung', 0, true);
});

// 2. Zeitsteuerung: 06:58 bis 20:58 Uhr Abfrage triggern
schedule("58 6-20 * * *", async () => {
    const chargingActive = getState('ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive').val;
    if (chargingActive) {
        setState('bluelink.0.KNAFD81A7S6058382.control.force_refresh_from_car', true);
    } else {
        setState('bluelink.0.KNAFD81A7S6058382.control.force_refresh_from_server', true);
    }
});

// 3. VIS-Trigger: Nur nachts (19:30 - 06:30) bei Seitenaufruf aktualisieren
on({ id: 'vis.0.control.data', change: 'ne' }, async (obj) => {
    const isNight = compareTime('06:29', '19:29', 'not between');
    const isKiaPage = (obj.state.val === 'projektx/960_Auto' || obj.state.val === 'projektx_sp/960_Auto');
    if (isNight && isKiaPage) {
        setState('bluelink.0.KNAFD81A7S6058382.control.force_refresh_from_server', true);
    }
});

// 4. Haupt-Logik: Zähler & Google Maps Standort
on({ 
    id: [
        'bluelink.0.KNAFD81A7S6058382.control.force_refresh',
        'bluelink.0.KNAFD81A7S6058382.control.force_refresh_from_car',
        'bluelink.0.KNAFD81A7S6058382.control.force_refresh_from_server'
    ], 
    change: 'ne' 
}, async (obj) => {
    // Zähler & Zeitstempel setzen
    let currentCounter = (getState('0_userdata.0.Energie.Kia_e_niro.Anz_Aktualisierung').val || 0) + 1;
    setState('0_userdata.0.Energie.Kia_e_niro.Anz_Aktualisierung', currentCounter, true);
    setState('0_userdata.0.Energie.Kia_e_niro.Aktualisierung', formatDate(new Date(), 'hh:mm'), true);

    if (timeout_kia) return; // Abbrechen wenn Sperre aktiv

    timeout_kia = setTimeout(async () => {
        timeout_kia = null;
        const lat = getState('bluelink.0.KNAFD81A7S6058382.vehicleLocation.lat').val;
        const lon = getState('bluelink.0.KNAFD81A7S6058382.vehicleLocation.lon').val;
        const apiKey = getState('0_userdata.0.google.mapsAPItoken').val;

        if (!lat || !lon || !apiKey) return;

        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;

        httpGet(url, { timeout: 5000, responseType: 'text' }, (err, response) => {
            if (err || !response || !response.data) return;
            try {
                const result = JSON.parse(response.data);
                if (result && result.results && result.results[0]) {
                    const newAddress = result.results[0].formatted_address;
                    const oldAddress = getState('0_userdata.0.Energie.Kia_e_niro.Standort').val;
                    if (newAddress !== oldAddress) {
                        setStateDelayed('0_userdata.0.Energie.Kia_e_niro.Standort', newAddress, true, 500, false);
                    }
                }
            } catch (e) { log("Kia JSON Error: " + e, "warn"); }
        });
    }, 60000);
});