/**
 * Name:   Kia e-Niro Master-Steuerung v2.1
 * Zweck:  Zentrales Management für Standort, Status-Mirroring und 12V-Schutz.
 * Enthält: Abfrage-Logik, Google Maps Geocoding und Überwachung der Bedienelemente.
 */

// --- 1. KONFIGURATION ---
const VIN = 'bluelink.0.KNAFD81A7S6058382';
const PATH_USER = '0_userdata.0.Energie.Kia_e_niro';

// Zentrale Objekt-Struktur für alle IDs
const IDS = {
    // Bluelink Steuer-Datenpunkte (Eingang vom Adapter)
    ctrlCharge:    `${VIN}.control.charge`,
    ctrlChargeStop: `${VIN}.control.charge_stop`,
    ctrlClimaStart: `${VIN}.control.clima.start`,
    ctrlClimaStop:  `${VIN}.control.clima.stop`,
    ctrlLock:       `${VIN}.control.lock`,
    ctrlUnlock:     `${VIN}.control.unlock`,
    refreshCar:     `${VIN}.control.force_refresh_from_car`,
    refreshSrv:     `${VIN}.control.force_refresh_from_server`,
    lat:            `${VIN}.vehicleLocation.lat`,
    lon:            `${VIN}.vehicleLocation.lon`,
    
    // Externe Hardware / Userdata
    chargingActive: 'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive',
    googleToken:    '0_userdata.0.google.mapsAPItoken',
    
    // Ziel-Datenpunkte in 0_userdata (Ausgang)
    u_counter:      `${PATH_USER}.Anz_Aktualisierung`,
    u_standort:     `${PATH_USER}.Standort`,
    u_updateTime:   `${PATH_USER}.Aktualisierung`,
    u_chargeState:  `${PATH_USER}.charge`,
    u_klimaState:   `${PATH_USER}.klima_status`,
    u_doorLock:     `${PATH_USER}.doorlock`
};

// Interne Variablen (Cache/Sperren)
let lastLat = 0;
let lastLon = 0;
let isLocked = false;

// --- 2. AUTOMATISCHE INITIALISIERUNG ---
// Erstellt alle fehlenden Datenpunkte im Userdata-Bereich.
async function initKiaSystem() {
    const states = [
        { id: IDS.u_counter,      type: 'number',  unit: '',    name: 'Anzahl Aktualisierungen heute' },
        { id: IDS.u_standort,     type: 'string',  unit: '',    name: 'Aktueller Standort' },
        { id: IDS.u_updateTime,   type: 'string',  unit: 'Uhr', name: 'Letzte Aktualisierung' },
        { id: IDS.u_chargeState,  type: 'boolean', unit: '',    name: 'Ladestatus (aktiv/inaktiv)' },
        { id: IDS.u_klimaState,   type: 'boolean', unit: '',    name: 'Klimatisierung (an/aus)' },
        { id: IDS.u_doorLock,     type: 'boolean', unit: '',    name: 'Fahrzeug verriegelt' }
    ];

    for (const s of states) {
        if (!existsState(s.id)) {
            await createStateAsync(s.id, s.type === 'number' ? 0 : false, { 
                type: s.type, unit: s.unit, name: s.name 
            });
        }
    }
    console.log("[Kia] Initialisierung der Datenpunkte abgeschlossen.");
}
initKiaSystem();

// --- 3. STATUS-MONITORING (CONTROL MIRRORING) ---
// Überwacht die Buttons im Bluelink-Adapter und spiegelt den Status in Userdata.
on({ id: [IDS.ctrlCharge, IDS.ctrlChargeStop, IDS.ctrlClimaStart, IDS.ctrlClimaStop, IDS.ctrlLock, IDS.ctrlUnlock], change: 'any' }, (obj) => {
    if (!obj.state.val) return; // Nur reagieren, wenn der Datenpunkt getriggert wurde (true)

    const id = obj.id;
    if (id.includes('charge')) {
        setState(IDS.u_chargeState, id.includes('charge_stop') ? false : true, true);
    } 
    else if (id.includes('clima')) {
        setState(IDS.u_klimaState, id.includes('stop') ? false : true, true);
    } 
    else if (id.includes('lock')) {
        setState(IDS.u_doorLock, id.includes('unlock') ? false : true, true);
    }
});

// --- 4. REFRESH-LOGIK & 12V-SCHUTZ ---
// Zeitgesteuerter Refresh (06:58 bis 20:58 Uhr)
schedule("58 6-20 * * *", () => {
    const charging = getState(IDS.chargingActive).val;
    // Während des Ladens: aktives Wecken (Car), sonst nur Server-Daten
    setState(charging ? IDS.refreshCar : IDS.refreshSrv, true);
});

// VIS-Trigger: Nachts bei Seitenaufruf
on({ id: 'vis.0.control.data', change: 'ne' }, (obj) => {
    const isNight = compareTime('06:29', '19:29', 'not between');
    if (isNight && obj.state.val && obj.state.val.includes('960_Auto')) {
        if (!isLocked) {
            setState(IDS.refreshSrv, true);
            activateLock(300000); // 5 Min Sperre für VIS-Calls
        }
    }
});

// --- 5. STANDORT- & ZÄHLER-LOGIK ---
// Reagiert auf alle Refresh-Events (Server, Car oder manuell)
on({ id: [IDS.refreshCar, IDS.refreshSrv, `${VIN}.control.force_refresh`], change: 'ne' }, async (obj) => {
    if (obj.state.val !== true) return;

    // Statistik und Zeitstempel
    let count = (getState(IDS.u_counter).val || 0) + 1;
    setState(IDS.u_counter, count, true);
    setState(IDS.u_updateTime, formatDate(new Date(), 'hh:mm'), true);

    if (isLocked) return;
    activateLock(60000); // 60s Standardsperre

    const lat = getState(IDS.lat).val;
    const lon = getState(IDS.lon).val;
    const apiKey = getState(IDS.googleToken).val;

    if (!lat || !lon || !apiKey) return;

    // Geocoding-Kostenbremse: Standort-Delta prüfen (~110m Radius)
    if (lat.toFixed(3) === lastLat.toFixed(3) && lon.toFixed(3) === lastLon.toFixed(3)) return;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;

    httpGet(url, (err, response) => {
        if (err || !response || !response.data) return;
        try {
            const data = JSON.parse(response.data);
            if (data.results && data.results[0]) {
                const address = data.results[0].formatted_address;
                lastLat = lat;
                lastLon = lon;
                setState(IDS.u_standort, address, true);
            }
        } catch (e) { console.error("Kia Geocoding Error: " + e); }
    });
});

/**
 * Sperr-Funktion zur Vermeidung von Überlastung
 */
function activateLock(ms) {
    isLocked = true;
    setTimeout(() => { isLocked = false; }, ms);
}