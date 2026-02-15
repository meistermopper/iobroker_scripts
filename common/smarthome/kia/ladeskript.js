// =============================================================================
// EV3 MASTER-LADESKRIPT v4.1 (CONST/LET & LADELEISTUNG)
// =============================================================================

// --- KONFIGURATION (Konstanten) ---
const VIN = 'bluelink.0.KNAFD81A7S6058382';
const USER_DATA = '0_userdata.0.Energie.Kia_e_niro';

const WB_STAT   = 'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status';
const WB_TRANS  = 'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive';
const WB_MAX_CUR = 'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.configuration.evb_MaximumStationCurrent';
const GOTIFY_TOKEN = getState('0_userdata.0.gotifytoken.iobroker').val;

// Pfad-Variablen
const DP_SOC    = `${VIN}.vehicleStatusRaw.Green.BatteryManagement.BatteryRemain.Ratio`;
const DP_12V    = `${VIN}.vehicleStatusRaw.Electronics.Battery.Level`;
const DP_CONN   = `${VIN}.vehicleStatusRaw.Green.ChargingInformation.ConnectorFastening.State`;
const DP_TIME   = `${VIN}.vehicleStatusRaw.Green.ChargingInformation.Charging.RemainTime`;
const DP_LIMIT  = `${USER_DATA}.Ladeprozent`;
const DP_REST   = `${USER_DATA}.Restladezeit`;
const DP_POWER  = `${USER_DATA}.Ladeleistung`;

// --- VARIABLEN (Let) ---
let watchdog = null;

// --- ZENTRALE FUNKTIONEN ---

function ev3Notify(text, prio = 1) {
    sendTo('telegram', 'send', { text: text });
    exec(`curl "https://mygotify.meistermopper.de/message?token=${GOTIFY_TOKEN}" -F "title=ioBroker EV3" -F "message=${text}" -F "priority=${prio}"`);
    
    if (compareTime('08:00', '20:00', 'between')) {
        let voiceMsg = text.replace(/%/g, ' Prozent').replace(/SOC/gi, 'Ladestand')
                           .replace(/AC/g, 'an der Wallbox').replace(/DC/g, 'Schnell-Ladung')
                           .replace(/🔋|🔌|⚠️|🚗/g, '').replace(/_/g, ' ');         
        sendTo("sayit", "say", { text: voiceMsg });
    }
}

// --- LOGIK-TRIGGER ---

// 1. LADEART-ERKENNUNG
on({ id: DP_CONN, change: 'any' }, (obj) => {
    const limF = Number(getState(`${VIN}.control.charge_limit_fast`).val);
    const limS = Number(getState(`${VIN}.control.charge_limit_slow`).val);
    
    if (obj.state.val === 3) {
        setState(DP_LIMIT, limF, true);
    } else if (obj.state.val === 1 || obj.state.val === 2) {
        setState(DP_LIMIT, limS, true);
    }
});

// 2. STOPP-LOGIK & LIMIT-SYNC
on({ id: DP_SOC, change: 'ne' }, (obj) => {
    const conn = getState(DP_CONN).val;
    const targetRaw = (conn === 3) ? getState(`${VIN}.control.charge_limit_fast`).val : getState(`${VIN}.control.charge_limit_slow`).val;
    const target = Number(targetRaw);

    setState(DP_LIMIT, target, true);

    if (obj.state.val >= target && obj.oldState.val < target) {
        if (getState(WB_TRANS).val === true) setState(WB_TRANS, false);
        ev3Notify(`🔋 EV3 Ladeziel von ${target}% erreicht. Ladung beendet.`);
    }
});

// 3. WALLBOX-STATUS: LEISTUNG & WATCHDOG
on({ id: WB_STAT, change: 'ne' }, (obj) => {
    // Teil A: Leistung
    if (obj.state.val === 'Charging') {
        const currentAmps = getState(WB_MAX_CUR).val;
        setState(DP_POWER, (currentAmps * 66), true);
    } else {
        setState(DP_POWER, 0, true);
    }

    // Teil B: Watchdog
    if (obj.state.val === 'Preparing') {
        watchdog = setTimeout(() => {
            if (getState(WB_STAT).val !== 'Charging') {
                ev3Notify("⚠️ Warnung: Ladung startet nicht!", 5);
            }
        }, 120000);
    } else if (watchdog) {
        clearTimeout(watchdog);
        watchdog = null;
    }
});

// 4. 12V SCHUTZ
on({ id: DP_12V, change: 'ne' }, (obj) => {
    if (obj.state.val <= 50) ev3Notify(`⚠️ 12V Batterie niedrig: ${obj.state.val}%!`, 5);
});

// 5. RESTZEIT FORMATIERUNG
on({ id: DP_TIME, change: 'any' }, (obj) => {
    const m = obj.state.val;
    if (m > 0) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        setState(DP_REST, `${h}:${min < 10 ? '0' + min : min}`, true);
    } else {
        setState(DP_REST, "0:00", true);
    }
});