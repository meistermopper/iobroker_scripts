/**
 * =============================================================================
 * SKRIPT: EV3 LADE-MASTER v6.2.0
 * =============================================================================
 * KONZEPT: Fokussiertes Start/Stop Management für den Kia EV3.
 * STRATEGIE: Nutzung der fixen 6A (ca. 4,1 kW) für zwei Betriebsmodi:
 * 1. MANUELL: User schaltet in VIS (Automatik AUS).
 * 2. PV-AUTO: Skript schaltet nach Überschuss (Automatik AN).
 * ÄNDERUNGEN:
 * - Beibehaltung aller Statistiken und Schutzfunktionen.
 * - Wechseln der Sayit-Ansagen von Stunden auf Minuten, wenn 0 Std.
 * =============================================================================
 */

// --- 1. SETUP: DIE DIGITALE NERVENZENTRALE (21 DATENPUNKTE) ---

const VIN = 'bluelink.0.KNAFD81A7S6058382';
const PATH_USER = '0_userdata.0.Energie.Kia_e_niro';

const IDS = {
    // Wallbox (Hardware via OCPP)
    wbStat:    'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status',            // [1] Status (Charging, Preparing...)
    wbTrans:   'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive', // [2] Schaltet den Stromfluss
    wbAvail:   'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.availability',      // [3] Reset / Verfügbarkeit

    // Fahrzeugdaten (Cloud)
    soc:       `${VIN}.vehicleStatusRaw.Green.BatteryManagement.BatteryRemain.Ratio`, // [4] Ladestand %
    bat12v:    `${VIN}.vehicleStatusRaw.Electronics.Battery.Level`,                   // [5] 12V Batterie-Schutz
    conn:      `${VIN}.vehicleStatusRaw.Green.ChargingInformation.ConnectorFastening.State`, // [6] Stecker-Status
    remTime:   `${VIN}.vehicleStatusRaw.Green.ChargingInformation.Charging.RemainTime`, // [7] Restzeit in Min.
    refresh:   `${VIN}.control.force_refresh`,                                        // [8] Fahrzeug aufwecken

    // Energie-Zentrum (Hardware-Werte)
    pvPower:   'solax.0.data.acpower',                                                // [9] PV Watt aktuell
    pvAverage: '0_userdata.0.Energie.PV.Durchschnitt',                                // [10] Geglätteter Wert (EMA)
    netPower:  '0_userdata.0.Energie.PV.Netzbezug',                                   // [11] Hauszähler (+Bezug/-Einspeisung)
    hausCons:  '0_userdata.0.Energie.PV.Hausverbrauch',                               // [12] Eigenverbrauch Haus
    batSocPV:  'modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)',    // [13] Hausspeicher %

    // Steuerung & Statistik (VIS)
    u_auto:    `${PATH_USER}.autoladen`,      // [14] Schalter: PV-Automatik an/aus
    u_limit:   `${PATH_USER}.Ladeprozent`,    // [15] Ziel-SOC Slider
    u_smooth:  `${PATH_USER}.Glaettung_Zeit`,  // [16] EMA-Trägheit Slider
    u_power:   `${PATH_USER}.Ladeleistung`,   // [17] Anzeige Watt (fest 3690W)
    u_timeDay: `${PATH_USER}.Ladezeit`,       // [18] Lademinuten heute
    u_rest:    `${PATH_USER}.Restladezeit`,   // [19] HH:MM Anzeige
    aliasKm:   'alias.0.umrechnen.kia_ladekm',    // [20] gewonnene Reichweite
    aliasDur:  'alias.0.umrechnen.kia_ladezeit'  // [21] Zeit-Objekt
};

// --- PARAMETER ---
const PV_START_LIMIT   = 4600;  // Startschwelle (Sonne muss > 4,6kW + Puffer liefern)
const FIXED_CHARGE_W   = 3690;  // Fixe Leistung bei 6A (220V * 3 Phasen * 6A)
const GOTIFY_TOKEN     = getState('0_userdata.0.gotifytoken.iobroker').val;

let startZeitLaden = null;      // Merker für Statistik

// --- 2. INITIALISIERUNG ---

async function initLadeSystem() {
    // Erstellt nur noch die für diese Version nötigen Punkte
    if (!existsState(IDS.u_auto))   await createStateAsync(IDS.u_auto, true, { type: 'boolean', name: 'PV-Automatik' });
    if (!existsState(IDS.u_smooth)) await createStateAsync(IDS.u_smooth, 10, { type: 'number', name: 'EMA-Glättung' });
    if (!existsState(IDS.u_limit))  await createStateAsync(IDS.u_limit, 80, { type: 'number', name: 'Ladeziel' });
    
    console.log("[EV3 Master] v6.1.0 Initialisierung abgeschlossen. 21 Datenpunkte aktiv.");
}
initLadeSystem();

// --- 3. KOMMUNIKATION ---

function ev3Notify(text, prio = 1, spoken = null) {
    sendTo('telegram', 'send', { text: text });
    exec(`curl "https://mygotify.meistermopper.de/message?token=${GOTIFY_TOKEN}" -F "title=EV3 Master" -F "message=${text}" -F "priority=${prio}"`);
    
    // Sprachausgabe tagsüber
    if (compareTime('08:00', '20:00', 'between')) {
        // Wenn ein spezieller Sprechtext übergeben wurde (spoken), nutzen wir diesen.
        // Andernfalls nehmen wir den Standardtext.
        let voice = spoken || text;
        voice = voice.replace(/%/g, ' Prozent').replace(/SOC/gi, 'Ladestand').replace(/🔋|🔌|⚠️|🚗|❌/g, '');
        sendTo("sayit", "say", { text: voice });
    }
}

// --- 4. SMART PV-GLÄTTUNG (EMA) ---

/**
 * Errechnet den Durchschnitt der PV-Leistung zur Stabilisierung der Regelung.
 * Reagiert bei Abfall schnell, bei Anstieg träge.
 */
schedule("* * * * *", () => {
    const current = Number(getState(IDS.pvPower).val) || 0;
    const oldAvg = Number(getState(IDS.pvAverage).val) || current;
    const inertia = Number(getState(IDS.u_smooth).val) || 10;
    let alpha = (current < oldAvg) ? 0.5 : (1 / inertia);
    const newAvg = (alpha * current) + (1 - alpha) * oldAvg;
    setState(IDS.pvAverage, Math.round(newAvg), true);
});

// --- 5. AUTOMATIONS-LOGIK (PV-ÜBERSCHUSS) ---

/**
 * Überwacht den PV-Durchschnitt und schaltet die Ladung automatisch,
 * sofern der Automatik-Schalter in der VIS aktiv ist.
 */
on({ id: IDS.pvAverage, change: 'ne' }, (obj) => {
    if (!getState(IDS.u_auto).val) return; // Abbrechen, wenn Manuell-Modus gewählt ist

    const mittel = obj.state.val;
    const isTransActive = getState(IDS.wbTrans).val;
    const batSoc = getState(IDS.batSocPV).val;

    // START: Genügend Sonne (>4,6kW) und Hausspeicher gut gefüllt (>75%)
    if (!isTransActive && mittel > PV_START_LIMIT && batSoc > 75) {
        const wbStatus = getState(IDS.wbStat).val;
        if (wbStatus === 'Preparing') {
            setState(IDS.wbTrans, true);
            ev3Notify("🔋 Das Überschussladen des IWi three wurde mit 6 Ampere aktiviert.");
        }
    } 
    // STOP: Überschuss sinkt unter die Ladeleistung (Pausierung)
    else if (isTransActive && mittel < 4100) {
        setState(IDS.wbTrans, false);
        ev3Notify("⏸️ Das Laden des IWi three wurde beendet, der Ertrag ist zu gering.");
    }
});

// --- 6. MONITORING & STATISTIK ---

/**
 * Erfasst Ladedauer und setzt die Leistungsanzeige.
 */
on({ id: IDS.wbStat, change: 'ne' }, (obj) => {
    const status = obj.state.val;
    
    if (status === 'Charging') {
        startZeitLaden = Date.now();
        // Da die Box starr 6A lädt, setzen wir den festen Watt-Wert
        setState(IDS.u_power, FIXED_CHARGE_W, true);
    } 
    else if (startZeitLaden && (status === 'Finishing' || status === 'Available')) {
        // 1. Dauer des aktuellen Ladevorgangs in Minuten berechnen
        let dauerMin = Math.round((Date.now() - startZeitLaden) / 60000);
        
        // 2. Gesamtdauer für heute ermitteln (Bisherige Zeit + Aktuelle Zeit)
        let totalMin = (getState(IDS.u_timeDay).val || 0) + dauerMin;
        setState(IDS.u_timeDay, totalMin, true);
        
        setTimeout(() => {
            // 3. Optimierung der Sprachausgabe (SayIt)
            // Wir zerlegen die Gesamtminuten in Stunden und Restminuten,
            // damit Alexa/Google nicht "0 Uhr 49" sagt, sondern "49 Minuten".
            let h = Math.floor(totalMin / 60); // Ganze Stunden
            let m = totalMin % 60;             // Verbleibende Minuten
            
            // Fallunterscheidung für natürliche Sprache:
            // - Wenn Stunden > 0: "1 Stunde und 15 Minuten"
            // - Wenn Stunden = 0: "49 Minuten"
            let spokenTime = (h > 0) ? `${h} Stunde${h === 1 ? '' : 'n'} und ${m} Minuten` : `${m} Minuten`;
            
            // 4. Benachrichtigung senden (Text vs. Sprache getrennt)
            ev3Notify(`❌ Ladung beendet. Heute geladen: ${getState(IDS.aliasDur).val}`, 1, `Ladung beendet. Heute geladen: ${spokenTime}`);
        }, 2000);
        
        startZeitLaden = null;
        setState(IDS.u_power, 0, true);
    }
});

// --- 7. ZUSATZFUNKTIONEN ---

/**
 * Formatiert die verbleibende Ladezeit für die Anzeige in der VIS.
 */
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

// Täglicher Reset der Ladestatistik um 02:05 Uhr
schedule("5 2 * * *", () => { setState(IDS.u_timeDay, 0, true); });

// Schutz der 12V-Starterbatterie des Kia
on({ id: IDS.bat12v, change: 'ne' }, (obj) => {
    if (obj.state.val <= 50) ev3Notify(`⚠️ Kia 12V-Batterie kritisch!`, 5);
});
