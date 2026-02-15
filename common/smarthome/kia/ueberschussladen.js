// =============================================================================
// EV3 PV-ÜBERSCHUSS MASTER-LADESKRIPT v3.3 (Syntax Fix)
// =============================================================================

// --- KONFIGURATION ---
const vin = 'bluelink.0.KNAFD81A7S6058382';
const userDataPath = '0_userdata.0.Energie.Kia_e_niro';

const wallboxTrans  = 'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive';
const wallboxStatus = 'ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status';
const dpRatio       = `${vin}.vehicleStatusRaw.Green.BatteryManagement.BatteryRemain.Ratio`;
const dpLadeprozent = `${userDataPath}.Ladeprozent`;
const dpAutoladen   = `${userDataPath}.autoladen`;

const pvPowerDP     = 'solax.0.data.acpower';
const pvAverageDP   = '0_userdata.0.Energie.PV.Durchschnitt';
const pvListDP      = '0_userdata.0.Energie.PV.Liste_Durchschnitt';
const batSoCDP      = 'modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)';
const hausVerbrauch = '0_userdata.0.Energie.PV.Hausverbrauch';
const netzBezug     = '0_userdata.0.Energie.PV.Netzbezug';
const ladeZeitHeute = '0_userdata.0.Energie.Kia_e_niro.Ladezeit';

// Konfigurations-Werte
const PV_START_LIMIT = 4100; 
const BAT_MIN_SOC    = 75;   

let startZeitLaden;
let timeouts = {};

// --- HILFSFUNKTIONEN ---
function clearMyTimeout(key) {
    if (timeouts[key]) {
        clearTimeout(timeouts[key]);
        delete timeouts[key];
    }
}

function ev3Notify(text, priority = 1, sayItText = text) {
    const token = getState('0_userdata.0.gotifytoken.iobroker').val;
    sendTo('telegram', 'send', { text: text });
    console.log(`EV3 PV-Log: ${text}`);
    exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker EV3" -F "message=${text}" -F "priority=${priority}"`);
    
    if (compareTime('08:00', '20:00', 'between')) {
        sendTo("sayit", "say", { text: sayItText });
    }
}

// --- LOGIK ---

// 1. Gleitender Durchschnitt
schedule("* * * * *", () => {
    let liste = getState(pvListDP).val;
    if (!Array.isArray(liste)) liste = [0, 0, 0, 0, 0];
    liste.pop();
    liste.unshift(getState(pvPowerDP).val);
    setState(pvListDP, liste, true);

    let summe = liste.reduce((a, b) => a + b, 0);
    let mittel = Math.round((summe / 5) * 10) / 10;
    setState(pvAverageDP, mittel, true);
});

// 2. Tägliche Resets
schedule("5 2 * * *", () => {
    setState(ladeZeitHeute, 0, true);
});

// 3. Ladestatistik
on({ id: wallboxStatus, change: 'ne' }, (obj) => {
    if (obj.state.val === 'Charging') {
        startZeitLaden = Date.now();
        ev3Notify('🔋 Der Ladevorgang des EV3 wurde gestartet.', 1);
    } else if (obj.state.val === 'Finishing' && startZeitLaden) {
        let dauerMin = Math.round((Date.now() - startZeitLaden) / 60000);
        let bisher = getState(ladeZeitHeute).val || 0;
        setState(ladeZeitHeute, (bisher + dauerMin), true);
        
        setTimeout(() => {
            let infoDauer = getState('alias.0.umrechnen.kia_ladezeit').val;
            let infoKm = Math.round(getState('alias.0.umrechnen.kia_ladekm').val * 10) / 10;
            ev3Notify(`❌ Überschussladen beendet.\nHeutige Dauer: ${infoDauer}.\nReichweite + ${infoKm} km.`, 1);
        }, 1000);
        startZeitLaden = null;
    }
});

// 4. PV-Überschuss Steuerung
on({ id: pvAverageDP, change: 'ne' }, (obj) => {
    const mittel = obj.state.val;
    const autoladen = getState(dpAutoladen).val;
    const isTransActive = getState(wallboxTrans).val;
    const wbStatus = getState(wallboxStatus).val;
    const batSoC = getState(batSoCDP).val;
    const bezug = getState(netzBezug).val;
    const socAuto = getState(dpRatio).val;
    const ziel = getState(dpLadeprozent).val;

    if (autoladen && !isTransActive && mittel > PV_START_LIMIT && batSoC > BAT_MIN_SOC && 
       (wbStatus === 'Preparing' || wbStatus === 'Finishing') && socAuto < ziel && bezug < 200) {
        
        console.log('EV3: Start-Bedingungen erfüllt. Aktiviere Wallbox.');
        setState(wallboxTrans, true);
        setState(`${vin}.control.force_refresh`, true);

        clearMyTimeout('startCheck');
        timeouts['startCheck'] = setTimeout(() => {
            if (getState(hausVerbrauch).val < 3800) {
                let baseId = wallboxStatus.split('.status')[0];
                setState(`${baseId}.availability`, false);
                setTimeout(() => {
                    setState(`${baseId}.availability`, true);
                    setStateDelayed(wallboxTrans, true, 2000, false);
                }, 3000);
            }
        }, 120000);
    } 
    else if (mittel <= PV_START_LIMIT && (wbStatus === 'Charging' || wbStatus === 'SuspendedEV') && isTransActive && autoladen) {
        console.log('EV3: Überschuss zu gering. Stoppe Wallbox.');
        setState(wallboxTrans, false);
        setState(`${vin}.control.force_refresh`, true);
        
        clearMyTimeout('stopCheck');
        timeouts['stopCheck'] = setTimeout(() => {
            if (getState(wallboxStatus).val === 'Charging' && !getState(wallboxTrans).val) {
                setState(wallboxTrans, false);
            }
        }, 60000);
    }
});

// 5. OCPP Fehler-Korrektur
on({ id: wallboxTrans, change: 'ne' }, (obj) => {
    clearMyTimeout('errorCheck');
    timeouts['errorCheck'] = setTimeout(() => {
        const curStatus = getState(wallboxStatus).val;
        const curTrans = obj.state.val;

        if (curTrans && (curStatus === 'Preparing' || curStatus === 'Available' || curStatus === 'Finishing')) {
            let baseId = wallboxStatus.split('.status')[0];
            setState(`${baseId}.availability`, false);
            setTimeout(() => {
                setState(`${baseId}.availability`, true);
                setStateDelayed(wallboxTrans, true, 2000, false);
            }, 3000);
        }
    }, 5000);
});