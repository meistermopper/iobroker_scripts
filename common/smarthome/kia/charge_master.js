/**
 * =============================================================================
 * EV3 LADE-MASTER v5.8.2 - THE GUARDIAN (ULTIMATE STABLE)
 * =============================================================================
 * KONZEPT: Vollständiges Energie-Management für den Kia e-Niro.
 * STRATEGIE: Priorität für Hausgeräte (Sauna-Logik), Schutz der Hardware & Boost.
 * FIX: Syntax-Fehler in der Initialisierungs-Routine behoben.
 * =============================================================================
 */

// --- 1. SETUP: DIE DIGITALE NERVENZENTRALE ---
// Hier liegen alle Adressen. Falls sich ein Pfad ändert, musst du nur hier editieren.
const VIN = 'bluelink.0.KNAFD81A7S6058382';
const PATH_USER = '0_userdata.0.Energie.Kia_e_niro';

const IDS = {
    // Wallbox (OCPP-Schnittstelle)
    wbStat:    'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status',            // Zustand der Box (z.B. "Available")
    wbTrans:   'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive', // Schaltet den Stromfluss (Relais)
    wbMaxCur:  'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.configuration.evb_MaximumStationCurrent', // Ampere-Limit
    wbAvail:   'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.availability',      // Resettet die Box bei Hängern

    // Fahrzeug (Bluelink Cloud-Daten)
    soc:       `${VIN}.vehicleStatusRaw.Green.BatteryManagement.BatteryRemain.Ratio`, // Ladestand in %
    bat12v:    `${VIN}.vehicleStatusRaw.Electronics.Battery.Level`,                   // Schutz der Starterbatterie
    conn:      `${VIN}.vehicleStatusRaw.Green.ChargingInformation.ConnectorFastening.State`, 
    remTime:   `${VIN}.vehicleStatusRaw.Green.ChargingInformation.Charging.RemainTime`,
    refresh:   `${VIN}.control.force_refresh`,                                        // Auto aktiv abfragen

    // Energie-Zentrum (Hardware-Sensoren im Haus)
    pvPower:   'solax.0.data.acpower',                                                // PV-Erzeugung aktuell (Watt)
    pvAverage: '0_userdata.0.Energie.PV.Durchschnitt',                                // Ergebnis der Glättung
    netPower:  '0_userdata.0.Energie.PV.Netzbezug',                                   // Hauszähler (+Bezug/-Einspeisung)
    hausCons:  '0_userdata.0.Energie.PV.Hausverbrauch',                               // Summe aller Verbraucher
    batSocPV:  'modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)',    // Stand deines Hausspeichers

    // Steuerung (VIS & Userdata)
    u_auto:    `${PATH_USER}.autoladen`,     // Schalter: PV-Regelung an/aus
    u_boost:   `${PATH_USER}.Boost_Modus`,   // Schalter: Sofort 11kW (Priorität!)
    u_limit:   `${PATH_USER}.Ladeprozent`,   // Ziel-SOC
    u_smooth:  `${PATH_USER}.Glaettung_Zeit`, // Trägheit für die Sonne
    u_power:   `${PATH_USER}.Ladeleistung`,  // Aktuelle Leistung in Watt
    u_timeDay: `${PATH_USER}.Ladezeit`,      // Geladene Minuten heute
    u_rest:    `${PATH_USER}.Restladezeit`,  // Anzeige HH:MM
    aliasKm:   'alias.0.umrechnen.kia_ladekm',   // Reichweiten-Gewinn
    aliasDur:  'alias.0.umrechnen.kia_ladezeit' // Formatiertes Zeit-Objekt
};

// --- REGEL-PARAMETER (DIE KONFIGURATION) ---
const PV_START_LIMIT   = 4100;  // Startschwelle: ca. 6A bei 3 Phasen Überschuss
const GRID_BUFFER      = 150;   // Wir zielen auf 150W Einspeisung ab (Puffer)
const MIN_AMPS         = 60;    // Minimum: 6.0 Ampere (OCPP-Einheit: 10 = 1A)
const MAX_AMPS         = 160;   // Maximum: 16.0 Ampere (11 kW)
const MAX_SENSOR_AGE   = 60000; // Watchdog: Wenn der Lesekopf 60s schweigt -> Safe-State

const GOTIFY_TOKEN = getState('0_userdata.0.gotifytoken.iobroker').val;
let currentAmps = 60;           // Aktueller Wert an der Wallbox
let startZeitLaden = null;      // Merker für Ladedauer
let timer = {};                 // Timeout-Behälter

// --- 2. INITIALISIERUNG (FIXED SYNTAX) ---
/**
 * Erzeugt beim Skriptstart alle Punkte unter 0_userdata, falls diese fehlen.
 * Hier lag in v5.8.1 der Syntaxfehler. Jetzt sauber geschlossen.
 */
async function initLadeSystem() {
    if (!existsState(IDS.u_auto)) {
        await createStateAsync(IDS.u_auto, false, { type: 'boolean', name: 'PV-Automatik' });
    }
    if (!existsState(IDS.u_boost)) {
        await createStateAsync(IDS.u_boost, false, { type: 'boolean', name: 'Boost-Modus (11kW)' });
    }
    if (!existsState(IDS.u_smooth)) {
        await createStateAsync(IDS.u_smooth, 10, { type: 'number', name: 'EMA-Glättung' });
    }
    if (!existsState(IDS.u_limit)) {
        await createStateAsync(IDS.u_limit, 80, { type: 'number', name: 'Ladeziel' });
    }
    console.log("[EV3 Master] Initialisierung abgeschlossen.");
}
initLadeSystem();

// --- 3. KOMMUNIKATION ---
function ev3Notify(text, prio = 1) {
    sendTo('telegram', 'send', { text: text });
    exec(`curl "https://mygotify.meistermopper.de/message?token=${GOTIFY_TOKEN}" -F "title=EV3 Master" -F "message=${text}" -F "priority=${prio}"`);
    if (compareTime('08:00', '20:00', 'between')) {
        let voice = text.replace(/%/g, ' Prozent').replace(/SOC/gi, 'Ladestand').replace(/🔋|🔌|⚠️|🚗|❌/g, '');
        sendTo("sayit", "say", { text: voice });
    }
}

// --- 4. HARDWARE-KORREKTUR (DER "SCHUBS") ---
// Behebt OCPP-Status-Hänger durch kurzes Offline-Setzen der Box.
function forceWbTransition() {
    console.log("[EV3] Handshake-Fehler? Führe Wallbox-Reset (Schubs) durch...");
    setState(IDS.wbAvail, false);
    setTimeout(() => {
        setState(IDS.wbAvail, true);
        setStateDelayed(IDS.wbTrans, true, 2000, false);
    }, 3000);
}

// --- 5. SMART PV-GLÄTTUNG (EMA) ---
/**
 * Asymmetrischer Exponential Moving Average (EMA).
 * Formel: $S_t = \alpha \cdot Y_t + (1 - \alpha) \cdot S_{t-1}$
 * Reagiert bei fallenden PV-Werten schnell ($\alpha=0.5$), bei steigenden träge.
 */
schedule("* * * * *", () => {
    const current = Number(getState(IDS.pvPower).val) || 0;
    const oldAvg = Number(getState(IDS.pvAverage).val) || current;
    const inertia = Number(getState(IDS.u_smooth).val) || 10;
    let alpha = (current < oldAvg) ? 0.5 : (1 / inertia);
    const newAvg = (alpha * current) + (1 - alpha) * oldAvg;
    setState(IDS.pvAverage, Math.round(newAvg), true);
});

// --- 6. DYNAMISCHE LASTREGELUNG & WATCHDOG ---
/**
 * Berechnet den Ladestrom. Hausverbraucher (Sauna!) haben immer Vorfahrt.
 * Ausnahme: Der Boost-Modus ist aktiv.
 */
function adjustCurrentByGrid() {
    const isBoost = getState(IDS.u_boost).val;
    const isAuto  = getState(IDS.u_auto).val;
    const isActive = getState(IDS.wbTrans).val;

    if (!isActive) return;

    // --- FALL 1: BOOST-MODUS (Die Überholspur) ---
    if (isBoost) {
        if (currentAmps !== MAX_AMPS) {
            setState(IDS.wbMaxCur, MAX_AMPS);
            currentAmps = MAX_AMPS;
            console.log("[EV3] BOOST AKTIV: 11 kW erzwungen.");
        }
        return; 
    }

    // --- FALL 2: PV-AUTOMATIK ---
    if (isAuto) {
        const gridState = getState(IDS.netPower);
        const sensorAge = Date.now() - gridState.lc;

        // Watchdog: Falls der Lesekopf keine Daten liefert -> 6A
        if (sensorAge > MAX_SENSOR_AGE) {
            if (currentAmps !== MIN_AMPS) {
                setState(IDS.wbMaxCur, MIN_AMPS);
                currentAmps = MIN_AMPS;
                ev3Notify("⚠️ Sensor-Ausfall! Not-Drosselung auf 6A.", 5);
            }
            return;
        }

        // Budget-Berechnung: Ladeleistung + Überschuss - Puffer
        const budgetWatt = (getState(IDS.u_power).val || 0) + (-gridState.val) - GRID_BUFFER;
        
        // Berechnung ganzer Ampere: Abrunden zum Schutz vor Netzbezug
        // $I = \lfloor \text{Watt} / 690 \rfloor \cdot 10$
        let targetAmps = Math.floor(budgetWatt / 690) * 10;

        if (targetAmps < MIN_AMPS) targetAmps = MIN_AMPS;
        if (targetAmps > MAX_AMPS) targetAmps = MAX_AMPS;

        // Nur bei vollen Ampere-Stufen (10 Einheiten) regeln (Hardware-Schonung)
        if (Math.abs(targetAmps - currentAmps) >= 10) {
            setState(IDS.wbMaxCur, targetAmps);
            currentAmps = targetAmps;
        }
    }
}

// --- 7. TRIGGER-LOGIK ---

// Boost-Schalter Überwachung (Unterdrückt Start-Meldung)
on({ id: IDS.u_boost, change: 'ne' }, (obj) => {
    if (!obj.oldState || obj.oldState.val === undefined) { if (obj.state.val === false) return; }

    if (obj.state.val === true) {
        ev3Notify("🚀 Kia-Ladeboost: 11 kW Schnellladung gestartet!");
        setState(IDS.wbTrans, true); 
        setTimeout(adjustCurrentByGrid, 2000); 
    } else {
        ev3Notify("ℹ️ Kia-Ladeboost beendet. Rückkehr zur PV-Regelung.");
        adjustCurrentByGrid(); 
    }
});

// Sauna-Trigger: Jede Änderung am Hauszähler führt zur Strom-Anpassung
on({ id: IDS.netPower, change: 'ne' }, () => {
    if (getState(IDS.wbTrans).val) adjustCurrentByGrid();
});

// PV-Schnitt Trigger: Start/Stop der Ladung
on({ id: IDS.pvAverage, change: 'ne' }, (obj) => {
    if (getState(IDS.u_boost).val) return; 
    
    const mittel = obj.state.val;
    const isTransActive = getState(IDS.wbTrans).val;
    if (!getState(IDS.u_auto).val) return;

    if (!isTransActive && mittel > PV_START_LIMIT && getState(IDS.batSocPV).val > 75) {
        const wbStatus = getState(IDS.wbStat).val;
        if (wbStatus === 'Preparing' || wbStatus === 'Finishing') {
            setState(IDS.wbTrans, true);
            setState(IDS.refresh, true);
            ev3Notify("🔋 PV-Ladung gestartet.");
            
            if(timer.schubs) clearTimeout(timer.schubs);
            timer.schubs = setTimeout(() => {
                if (getState(IDS.hausCons).val < 3800) forceWbTransition();
            }, 120000);
        }
    } else if (isTransActive && mittel < 3800) {
        setState(IDS.wbTrans, false);
        setState(IDS.refresh, true);
        ev3Notify("⏸️ PV-Ladung pausiert.");
    }
});

// Statistik & Monitoring
on({ id: IDS.wbStat, change: 'ne' }, (obj) => {
    const status = obj.state.val;
    if (status === 'Charging') {
        startZeitLaden = Date.now();
        setState(IDS.u_power, (getState(IDS.wbMaxCur).val * 66), true);
    } else if (startZeitLaden && (status === 'Finishing' || status === 'Available')) {
        let dauerMin = Math.round((Date.now() - startZeitLaden) / 60000);
        setState(IDS.u_timeDay, (getState(IDS.u_timeDay).val || 0) + dauerMin, true);
        
        setTimeout(() => {
            const km = Math.round(getState(IDS.aliasKm).val * 10) / 10;
            ev3Notify(`❌ Ladung beendet. Heute: ${getState(IDS.aliasDur).val} (+${km} km).`, 1);
        }, 2000);
        
        startZeitLaden = null;
        setState(IDS.u_power, 0, true);
    }

    if (status === 'Preparing') {
        if (timer.watchdog) clearTimeout(timer.watchdog);
        timer.watchdog = setTimeout(() => {
            if (getState(IDS.wbStat).val !== 'Charging') ev3Notify("⚠️ Warnung: Wallbox hat keine Verbindung!", 5);
        }, 120000);
    } else { if (timer.watchdog) { clearTimeout(timer.watchdog); delete timer.watchdog; } }
});

// --- 8. RESTLICHE ÜBERWACHUNG ---
on({ id: IDS.bat12v, change: 'ne' }, (obj) => {
    if (obj.state.val <= 50) ev3Notify(`⚠️ Kia 12V-Batterie kritisch!`, 5);
});

on({ id: IDS.remTime, change: 'any' }, (obj) => {
    const m = obj.state.val;
    let t = "0:00";
    if (m > 0) {
        const hh = Math.floor(m / 60);
        const mm = m % 60;
        t = `${hh}:${mm < 10 ? '0' + mm : mm}`;
    }
    setState(IDS.u_rest, t, true);
});

schedule("5 2 * * *", () => { setState(IDS.u_timeDay, 0, true); });