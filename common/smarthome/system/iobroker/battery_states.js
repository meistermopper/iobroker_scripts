/**
 * SKRIPT: Akku-Zustands-Tabelle (V13 - 4-Spalten Ultra-Compact)
 * * BESCHREIBUNG:
 * Maximale Informationsdichte für Tablet-Dashboards.
 * 4 Geräte pro Zeile (insgesamt 12 Spalten pro Reihe).
 * Kein Header, optimiert für dunkle Hintergründe.
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
    thresholds: { 
        crit: 25, warn: 40,
        bigBattCrit: 3.3, bigBattWarn: 3.6  
    },
    symbols: { ok: "🟢", warn: "⚠️", crit: "❌" },
    design: {
        colorBgEven: "#151515",     
        colorBgOdd: "#000000",      
        colorDeviceName: "#ECECEC", 
        groupColor: "#A0C2A0",      
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    dpVIS: "0_userdata.0.Tabellen.akku",
    dpAlarmCount: "0_userdata.0.Tabellen.akkuAlarm",
    idGotifyToken: "0_userdata.0.gotifytoken.iobroker",
    useTelegram: true,
    useGotify: true
};

const ADAPTER_CONFIG = [
    { name: 'HUE DEVICES', selector: 'hue.*.*.battery', type: 'percent' },
    { name: 'ZIGBEE DEVICES', selector: 'zigbee.*.*.battery', type: 'percent' },
    { name: 'HOMEMATIC IP', selector: 'hm-rpc.*.*.0.LOW_BAT', type: 'bool' },
    { name: 'HOMEMATIC IP', selector: 'hm-rpc.*.*.0.OPERATING_VOLTAGE', type: 'volt' },
    { name: 'FULLYBROWSER', selector: 'fullybrowser.*.*.Info.batteryLevel', type: 'percent' }
];

// --- 2. LOGIK-FUNKTIONEN ---

function getSmartName(id) {
    const parts = id.split('.');
    let name = "";
    if (parts[0] === 'zigbee' || parts[0] === 'hm-rpc') {
        const deviceId = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const deviceObj = getObject(deviceId);
        if (deviceObj && deviceObj.common && deviceObj.common.name) {
            name = deviceObj.common.name;
        }
    } 
    if (!name) {
        const obj = getObject(id);
        if (obj && obj.common && obj.common.name) name = obj.common.name;
    }
    if (typeof name === 'object') name = name.de || name.en;
    if (typeof name === 'string') {
        return name.replace(/:\d+.*$/g, "").replace(/\.battery$|\.percent$|\.battery_percent$/i, "").replace(/_/g, " ").trim();
    }
    return id;
}

function evaluateVoltage(v) {
    let res = { status: CONFIG.symbols.ok, color: "lightgreen", isCrit: false };
    if (v > 3.2) {
        if (v <= CONFIG.thresholds.bigBattCrit) { res.status = CONFIG.symbols.crit; res.color = "red"; res.isCrit = true; }
        else if (v <= CONFIG.thresholds.bigBattWarn) { res.status = CONFIG.symbols.warn; res.color = "yellow"; }
    } else if (v <= 1.5) {
        if (v < 1.1) { res.status = CONFIG.symbols.crit; res.color = "red"; res.isCrit = true; }
        else if (v <= 1.2) { res.status = CONFIG.symbols.warn; res.color = "yellow"; }
    } else {
        if (v < 2.2) { res.status = CONFIG.symbols.crit; res.color = "red"; res.isCrit = true; }
        else if (v <= 2.5) { res.status = CONFIG.symbols.warn; res.color = "yellow"; }
    }
    return res;
}

async function collectGroupedData() {
    let groups = {};
    let allCritical = [];
    for (const conf of ADAPTER_CONFIG) {
        if (!groups[conf.name]) groups[conf.name] = [];
        const states = $(conf.selector);
        states.each(id => {
            const state = getState(id);
            if (!state || state.val === null) return;
            const val = state.val;
            let valNum = (conf.type === 'bool') ? (val ? 10 : 100) : parseFloat(val);
            let displayValue = (conf.type === 'bool') ? (val ? "low bat" : "full bat") : `${valNum.toFixed(1)} ${conf.type === 'percent' ? '%' : 'V'}`;
            let color = "lightgreen";
            let status = CONFIG.symbols.ok;
            let isCrit = false;
            if (conf.type === 'percent') {
                if (valNum <= CONFIG.thresholds.crit) { color = "#FF5252"; status = CONFIG.symbols.crit; isCrit = true; }
                else if (valNum <= CONFIG.thresholds.warn) { color = "#FFD740"; status = CONFIG.symbols.warn; }
            } else if (conf.type === 'volt') {
                const evalV = evaluateVoltage(valNum);
                color = evalV.color === "red" ? "#FF5252" : (evalV.color === "yellow" ? "#FFD740" : "lightgreen"); 
                status = evalV.status; isCrit = evalV.isCrit;
            } else if (conf.type === 'bool' && val) {
                color = "#FF5252"; status = CONFIG.symbols.crit; isCrit = true;
            }
            const deviceName = getSmartName(id);
            if (isCrit) allCritical.push({ name: deviceName, val: displayValue });
            groups[conf.name].push({ device: deviceName, valNum: valNum, value: displayValue, status: status, color: color });
        });
    }
    for (let key in groups) { groups[key].sort((a, b) => a.valNum - b.valNum); }
    return { groups, allCritical };
}

// --- 4. HTML GENERATOR (4-SPALTEN LOGIK) ---

function buildClassicHTML(groupedData) {
    let htmlRows = "";
    for (const [groupName, devices] of Object.entries(groupedData)) {
        if (devices.length === 0) continue;
        
        // GRUPPENÜBERSCHRIFT (spannt nun über 12 Spalten: 4 x [Name, Wert, Status])
        htmlRows += `<tr style="background-color: ${CONFIG.design.colorBgOdd}; color: ${CONFIG.design.groupColor}; font-style: italic; font-weight: bold;">
                <td colspan="12" style="padding: 12px 8px 4px 8px; text-transform: uppercase; border-top: 1px solid #333; letter-spacing: 0.5px; font-size: 13px;">${groupName}</td></tr>`;
        
        // Sprung in 4er Schritten
        for (let i = 0; i < devices.length; i += 4) {
            const dev1 = devices[i];
            const dev2 = devices[i + 1] || { device: "", value: "", status: "", color: "" };
            const dev3 = devices[i + 2] || { device: "", value: "", status: "", color: "" };
            const dev4 = devices[i + 3] || { device: "", value: "", status: "", color: "" };
            
            const rowColor = (Math.floor(i / 4) % 2 === 0) ? CONFIG.design.colorBgEven : CONFIG.design.colorBgOdd;
            
            htmlRows += `<tr style="background-color: ${rowColor}; font-size: 11px; color: ${CONFIG.design.colorDeviceName}; border-bottom: 1px solid #111;">
                    <td style="padding: 5px 3px; width: 17%;">${dev1.device}</td>
                    <td style="text-align: right; width: 6%; color: ${dev1.color}; font-size: 10px;">${dev1.value}</td>
                    <td style="text-align: center; width: 2%;">${dev1.status}</td>
                    
                    <td style="padding: 5px 3px; width: 17%; border-left: 1px solid #222;">${dev2.device}</td>
                    <td style="text-align: right; width: 6%; color: ${dev2.color}; font-size: 10px;">${dev2.value}</td>
                    <td style="text-align: center; width: 2%;">${dev2.status}</td>
                    
                    <td style="padding: 5px 3px; width: 17%; border-left: 1px solid #222;">${dev3.device}</td>
                    <td style="text-align: right; width: 6%; color: ${dev3.color}; font-size: 10px;">${dev3.value}</td>
                    <td style="text-align: center; width: 2%;">${dev3.status}</td>

                    <td style="padding: 5px 3px; width: 17%; border-left: 1px solid #222;">${dev4.device}</td>
                    <td style="text-align: right; width: 6%; color: ${dev4.color}; font-size: 10px;">${dev4.value}</td>
                    <td style="text-align: center; width: 2%;">${dev4.status}</td>
                </tr>`;
        }
    }

    return `<table style="width: 100%; border-collapse: collapse; font-family: ${CONFIG.design.fontFamily};">${htmlRows}</table>`;
}

// --- 5. BENACHRICHTIGUNG ---

async function sendNotifications(criticalDevices) {
    if (criticalDevices.length === 0) return;
    const message = `⚠️ *Kritische Akkustände!*\n\n` + criticalDevices.map(d => `• ${d.name}: ${d.val}`).join('\n');
    if (CONFIG.useTelegram) sendTo('telegram', 'send', { text: message, parse_mode: 'Markdown' });
    if (CONFIG.useGotify) {
        const tokenState = await getStateAsync(CONFIG.idGotifyToken);
        if (tokenState && tokenState.val) {
            exec(`curl "https://mygotify.meistermopper.de/message?token=${tokenState.val}" -F "title=Batterie Alarm" -F "message=${message}" -F "priority=1"`);
        }
    }
}

// --- 6. MAIN ---
async function main() {
    const { groups, allCritical } = await collectGroupedData();
    setState(CONFIG.dpVIS, buildClassicHTML(groups), true);
    setState(CONFIG.dpAlarmCount, allCritical.length, true);
    await sendNotifications(allCritical);
}

schedule("0 */12 * * *", main);
main();