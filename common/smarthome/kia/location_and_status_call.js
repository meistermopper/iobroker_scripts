/**
 * =============================================================================
 * SKRIPT: KIA E-NIRO MASTER-STEUERUNG (VERSION 2.10)
 * =============================================================================
 * ZWECK: 
 * - Zentrales Management für Fahrzeug-Status (Sperrung, Klima, Laden).
 * - Standort-Visualisierung via Google Maps Geocoding.
 * - Schutz der 12V-Starterbatterie durch gezielte Abruf-Logik.
 * * ÄNDERUNGEN V2.10:
 * - Exakter View-Trigger: "projektx/960_Auto" (Tablet) ODER 
 * "projektx_sp/963_Standort_eNiro" (Smartphone) löst Fahrzeug-Refresh aus.
 * - Stündlicher Zeitplan (06:00 - 20:00 Uhr) bleibt für Server-Abfragen erhalten.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---

const VIN = 'bluelink.0.KNAFD81A7S6058382';
const PATH_USER = '0_userdata.0.Energie.Kia_e_niro';

const IDS = {
    // Adapter-Steuerung (Bluelink)
    ctrlCharge:      `${VIN}.control.charge`,
    ctrlChargeStop:  `${VIN}.control.charge_stop`,
    ctrlClimaStart:  `${VIN}.control.clima.start`,
    ctrlClimaStop:   `${VIN}.control.clima.stop`,
    ctrlLock:        `${VIN}.control.lock`,
    ctrlUnlock:      `${VIN}.control.unlock`,
    refreshCar:      `${VIN}.control.force_refresh_from_car`,    // Weckt das Auto (12V!)
    refreshSrv:      `${VIN}.control.force_refresh_from_server`, // Nur Server-Daten (schonend)
    lat:             `${VIN}.vehicleLocation.lat`,
    lon:             `${VIN}.vehicleLocation.lon`,
    
    // Externe Datenpunkte
    chargingActive:  'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive',
    googleToken:     '0_userdata.0.google.mapsAPItoken',
    
    // VIS Datenpunkte
    u_manualRefresh: `${PATH_USER}.Manual_Refresh_Location`,
    u_counter:       `${PATH_USER}.Anz_Aktualisierung`,
    u_standort:      `${PATH_USER}.Standort`,
    u_updateTime:    `${PATH_USER}.Aktualisierung`,
    u_chargeState:   `${PATH_USER}.charge`,
    u_klimaState:    `${PATH_USER}.klima_status`,
    u_doorLock:      `${PATH_USER}.doorlock`
};

let lastLat = 0;
let lastLon = 0;
let isLocked = false;      
let viewTriggerLock = 0;   

// --- 2. INITIALISIERUNG ---

async function initKiaSystem() {
    const states = [
        { id: IDS.u_manualRefresh, type: 'boolean', name: 'Manuellen Standort-Refresh auslösen', role: 'button' },
        { id: IDS.u_counter,       type: 'number',  name: 'Anzahl Aktualisierungen heute' },
        { id: IDS.u_standort,      type: 'string',  name: 'Aktueller Standort' },
        { id: IDS.u_updateTime,    type: 'string',  name: 'Letzte Aktualisierung' },
        { id: IDS.u_chargeState,   type: 'boolean', name: 'Ladestatus (aktiv/inaktiv)' },
        { id: IDS.u_klimaState,    type: 'boolean', name: 'Klimatisierung (an/aus)' },
        { id: IDS.u_doorLock,      type: 'boolean', name: 'Fahrzeug verriegelt' }
    ];
    for (const s of states) {
        if (!existsState(s.id)) {
            await createStateAsync(s.id, s.type === 'number' ? 0 : false, { 
                type: s.type, name: s.name, role: s.role || 'state' 
            });
        }
    }
}
initKiaSystem();

// --- 3. PRÄZISE VIEW-TRIGGER (TABLET & SMARTPHONE) ---

/**
 * Reagiert auf View-Wechsel.
 * Tablet: projektx/960_Auto
 * Smartphone: projektx_sp/963_Standort_eNiro
 */
on({ id: /^vis\..*\.control\.data$/, change: 'any' }, async (obj) => {
    if (!obj.state.val) return;

    const viewPath = obj.state.val; // Das Format ist meist "Projektname/Viewname"
    
    // Bedingung: Tablet-Hauptview ODER Smartphone-Standortview
    if (viewPath === 'projektx/960_Auto' || viewPath === 'projektx_sp/963_Standort_eNiro') {
        const now = Date.now();
        
        // 10 Minuten Schutz-Cooldown, um die 12V-Batterie nicht durch "Zappen" zu entleeren
        if (now > viewTriggerLock) {
            console.warn(`[Kia] Gezielte Fahrzeug-Abfrage durch View-Aufruf: ${viewPath}`);
            
            // EXAKTER WUNSCH: Abfrage direkt vom Auto
            setState(IDS.refreshCar, true);
            
            // Sperrzeit für den nächsten automatischen Aufruf setzen
            viewTriggerLock = now + 600000; 
        } else {
            console.log(`[Kia] View ${viewPath} aufgerufen, aber Abfrage noch im Cooldown.`);
        }
    }
});

// --- 4. MANUELLER REFRESH-BUTTON ---

on({ id: IDS.u_manualRefresh, val: true, change: 'any' }, (obj) => {
    console.warn("[Kia] Manueller Standort-Refresh via VIS ausgelöst.");
    setState(IDS.refreshCar, true);
    setTimeout(() => { setState(IDS.u_manualRefresh, false, true); }, 500);
});

// --- 5. ZEITPLAN (SERVER-REFRESH) ---

/**
 * Stündliche Abfrage vom SERVER zwischen 06:00 und 20:00 Uhr.
 * Dies belastet die 12V Batterie nicht, da das Auto nicht aufgeweckt wird.
 */
schedule("58 6-20 * * *", () => {
    //console.log("[Kia] Stündlicher Server-Refresh (geplant).");
    setState(IDS.refreshSrv, true);
});

schedule("0 0 * * *", () => {
    setState(IDS.u_counter, 0, true);
});

// --- 6. STANDORT-LOGIK (GOOGLE MAPS) ---

on({ id: [IDS.refreshCar, IDS.refreshSrv, `${VIN}.control.force_refresh`], change: 'any' }, async (obj) => {
    if (obj.state.val !== true) return;

    setState(IDS.u_counter, (getState(IDS.u_counter).val || 0) + 1, true);
    setState(IDS.u_updateTime, formatDate(new Date(), 'hh:mm'), true);

    processLocationUpdate();
});

async function processLocationUpdate() {
    if (isLocked) return;
    activateLock(30000); 

    const lat = getState(IDS.lat).val;
    const lon = getState(IDS.lon).val;
    const apiKey = getState(IDS.googleToken).val;

    if (!lat || !lon || !apiKey) return;

    if (lat.toFixed(4) === lastLat.toFixed(4) && lon.toFixed(4) === lastLon.toFixed(4)) {
        return;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;

    httpGet(url, (err, response) => {
        if (err || !response || !response.data) return;
        try {
            const data = JSON.parse(response.data);
            if (data.results?.[0]) {
                const address = data.results[0].formatted_address;
                lastLat = lat;
                lastLon = lon;
                setState(IDS.u_standort, address, true);
                //console.log(`[Kia] Standort-Update via Google: ${address}`);
            }
        } catch (e) { console.error("[Kia] Geocoding Fehler: " + e); }
    });
}

// --- 7. STATUS-SPIEGELUNG ---

on({ id: [IDS.ctrlCharge, IDS.ctrlChargeStop, IDS.ctrlClimaStart, IDS.ctrlClimaStop, IDS.ctrlLock, IDS.ctrlUnlock], change: 'any' }, (obj) => {
    if (!obj.state.val) return;
    const id = obj.id;
    
    if (id.includes('charge')) {
        setState(IDS.u_chargeState, !id.includes('charge_stop'), true);
    } else if (id.includes('clima')) {
        setState(IDS.u_klimaState, !id.includes('stop'), true);
    } else if (id.includes('lock')) {
        setState(IDS.u_doorLock, !id.includes('unlock'), true);
    }
});

function activateLock(ms) {
    isLocked = true;
    setTimeout(() => { isLocked = false; }, ms);
}