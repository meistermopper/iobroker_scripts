/**
 * =============================================================================
 * SKRIPT: KIA E-NIRO MASTER-STEUERUNG (VERSION 2.8)
 * =============================================================================
 * ZWECK: 
 * - Zentrales Management für Fahrzeug-Status (Sperrung, Klima, Laden).
 * - Standort-Visualisierung via Google Maps Geocoding.
 * - Schutz der 12V-Starterbatterie durch intelligente Abfrage-Intervalle.
 * * ÄNDERUNGEN V2.8:
 * - Trigger für Smartphone-View "963_Standort_eNiro" hinzugefügt.
 * - Multi-Projekt Unterstützung für Tablet (projektx) und Smartphone (projektx_sp).
 * =============================================================================
 */

// --- 1. KONFIGURATION ---

// Fahrzeug-ID und Basis-Pfad
const VIN = 'bluelink.0.KNAFD81A7S6058382';
const PATH_USER = '0_userdata.0.Energie.Kia_e_niro';

// Datenpunkt-Mapping
const IDS = {
    // Adapter-Steuerung (Bluelink)
    ctrlCharge:      `${VIN}.control.charge`,
    ctrlChargeStop:  `${VIN}.control.charge_stop`,
    ctrlClimaStart:  `${VIN}.control.clima.start`,
    ctrlClimaStop:   `${VIN}.control.clima.stop`,
    ctrlLock:        `${VIN}.control.lock`,
    ctrlUnlock:      `${VIN}.control.unlock`,
    refreshCar:      `${VIN}.control.force_refresh_from_car`, // Weckt das Auto (12V!)
    refreshSrv:      `${VIN}.control.force_refresh_from_server`, // Nur Server-Daten
    lat:             `${VIN}.vehicleLocation.lat`,
    lon:             `${VIN}.vehicleLocation.lon`,
    
    // Externe Trigger & Token
    chargingActive:  'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive',
    googleToken:     '0_userdata.0.google.mapsAPItoken',
    
    // Eigene Datenpunkte für VIS
    u_manualRefresh: `${PATH_USER}.Manual_Refresh_Location`,
    u_counter:       `${PATH_USER}.Anz_Aktualisierung`,
    u_standort:      `${PATH_USER}.Standort`,
    u_updateTime:    `${PATH_USER}.Aktualisierung`,
    u_chargeState:   `${PATH_USER}.charge`,
    u_klimaState:    `${PATH_USER}.klima_status`,
    u_doorLock:      `${PATH_USER}.doorlock`
};

// Interne Variablen
let lastLat = 0;
let lastLon = 0;
let isLocked = false;      // Sperre für Geocoding-API
let viewTriggerLock = 0;   // Sperre für automatischen View-Refresh (12V Schutz)

// --- 2. INITIALISIERUNG ---

/**
 * Erstellt alle benötigten Datenpunkte unter 0_userdata.0, falls diese fehlen.
 */
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
                type: s.type, 
                name: s.name, 
                role: s.role || 'state' 
            });
        }
    }
}
initKiaSystem();

// --- 3. VIEW-TRIGGER (Tablet & Smartphone) ---

/**
 * Überwacht View-Wechsel in allen VIS-Projekten.
 * Triggert einen Refresh, wenn die Hauptseite oder die Standort-Seite geladen wird.
 */
on({ id: /^vis\..*\.control\.data$/, change: 'any' }, async (obj) => {
    if (!obj.state.val) return;

    const viewPath = obj.state.val; // z.B. "projektx_sp/963_Standort_eNiro"
    
    // Reagiere auf Haupt-View ODER die neue Smartphone-Standort-View
    if (viewPath.includes('960_Auto') || viewPath.includes('963_Standort_eNiro')) {
        const now = Date.now();
        
        // 10 Minuten Sperre zwischen automatischen Refreshes (Schutz der 12V Batterie)
        if (now > viewTriggerLock) {
            const charging = getState(IDS.chargingActive).val;
            
            console.warn(`[Kia] Automatischer Refresh via View-Aufruf: ${viewPath}`);
            
            /**
             * STRATEGIE:
             * Wenn das Auto lädt, wecken wir es auf (refreshCar), da die 12V Batterie gestützt wird.
             * Wenn es parkt, fragen wir nur den Server ab (refreshSrv), um Energie zu sparen.
             */
            setState(charging ? IDS.refreshCar : IDS.refreshSrv, true);
            
            // Sperrzeit für den nächsten automatischen Aufruf setzen
            viewTriggerLock = now + 600000; 
        } else {
            console.log(`[Kia] View-Refresh für ${viewPath} noch gesperrt (Cooldown aktiv).`);
        }
    }
});

// --- 4. MANUELLER REFRESH-BUTTON ---

/**
 * Erzwingt ein Standort-Update direkt vom Fahrzeug (ignoriert Cooldown).
 */
on({ id: IDS.u_manualRefresh, val: true, change: 'any' }, (obj) => {
    console.warn("[Kia] Manueller Standort-Refresh via VIS ausgelöst.");
    setState(IDS.refreshCar, true);
    // Button in VIS nach kurzem Moment zurücksetzen
    setTimeout(() => { setState(IDS.u_manualRefresh, false, true); }, 500);
});

// --- 5. ZEITPLAN & TAGES-RESET ---

/**
 * Stündliche Abfrage zwischen 06:00 und 20:00 Uhr (immer zur Minute 58).
 * Die Daten werden beim Laden vom Kfz geholt, zu anderen Zeiten nur vom Server.
 */
schedule("58 6-20 * * *", () => {
    const charging = getState(IDS.chargingActive).val;
    setState(charging ? IDS.refreshCar : IDS.refreshSrv, true);
});

/**
 * Setzt den Aktualisierungszähler um Mitternacht zurück.
 */
schedule("0 0 * * *", () => {
    setState(IDS.u_counter, 0, true);
});

// --- 6. STANDORT-LOGIK (GOOGLE MAPS) ---

/**
 * Reagiert auf jede Art von Refresh-Befehl und aktualisiert Zeit/Zähler/Standort.
 */
on({ id: [IDS.refreshCar, IDS.refreshSrv, `${VIN}.control.force_refresh`], change: 'any' }, async (obj) => {
    if (obj.state.val !== true) return;

    // Zähler erhöhen und Zeitstempel setzen
    setState(IDS.u_counter, (getState(IDS.u_counter).val || 0) + 1, true);
    setState(IDS.u_updateTime, formatDate(new Date(), 'hh:mm'), true);

    // Adress-Update via Google Maps starten
    processLocationUpdate();
});

async function processLocationUpdate() {
    if (isLocked) return;
    activateLock(30000); // 30 Sek API-Sperre (Schutz vor doppelten Kosten)

    const lat = getState(IDS.lat).val;
    const lon = getState(IDS.lon).val;
    const apiKey = getState(IDS.googleToken).val;

    if (!lat || !lon || !apiKey) return;

    // Nur aktualisieren, wenn sich die Koordinaten signifikant geändert haben (4 Nachkommastellen)
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
                console.log(`[Kia] Neuer Standort ermittelt: ${address}`);
            }
        } catch (e) { console.error("[Kia] Fehler beim Geocoding: " + e); }
    });
}

// --- 7. STATUS-SPIEGELUNG ---

/**
 * Spiegelt die komplexen Adapter-Zustände auf einfache VIS-Datenpunkte.
 */
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

// Hilfsfunktion für Sperrzeiten
function activateLock(ms) {
    isLocked = true;
    setTimeout(() => { isLocked = false; }, ms);
}