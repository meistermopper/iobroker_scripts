// =============================================================================
// UNIVERSAL MASTER v2.5 (DYNAMIC LOAD MANAGEMENT & PRECISION YIELD)
// =============================================================================

// --- 1. KONFIGURATION ---
const PATH_PV = "0_userdata.0.Energie.PV.";
const PATH_SAUNA = "0_userdata.0.Haushalt.";

const IDS = {
    pvPower: "solax.0.data.acpower",
    pvYieldToday: "solax.0.data.yieldtoday", 
    netPower: "smartmeter.0.1-0:16_7_0__255.value",
    batPower: "modbus.0.inputRegisters.100.842_Battery_Power_(System)",
    batSoc: "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)",
    speicherMax: "0_userdata.0.Energie.PV.Speichergroesse",
    saunaLogik: PATH_SAUNA + "sauna_laeuft",
    saunaTuer: "alias.0.sauna.tuer.opened",
    minSocSet: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
    minSocRead: "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
    heos: {
        saunaStatus: "0_userdata.0.heos.Sauna.radio_status",
        saunaSender: "0_userdata.0.heos.Sauna.sender",
        badStatus: "0_userdata.0.heos.Bad.radio_status",
        badSender: "0_userdata.0.heos.Bad.sender"
    },
    wallboxStatus: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status",
    wallboxCurrentLimit: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.configuration.evb_MaximumStationCurrent",
    verbraucherWatt: [
        "alias.0.kueche.boiler.ENERGY_Power", "alias.0.kueche.geschirr.ENERGY_Power",
        "alias.0.waschen.wasch.ENERGY_Power", "alias.0.waschen.trocknen.ENERGY_Power",
        "alias.0.kueche.backofen.ENERGY_Power"
    ]
};

const SAYIT_INSTANCES = ["sayit.0", "sayit.2", "sayit.3", "sayit.4", "sayit.5"];
const SAUNA_POWER = 7500; 
const RADIO_SENDER = "smoothjazz";
const GOTIFY_TOKEN_ID = "0_userdata.0.gotifytoken.iobroker";
const GOTIFY_SERVER = "mygotify.meistermopper.de";

// Variablen & Zähler
let pvP = 0, netP = 0, batP = 0, soc = 0, sMax = 0;
let tVerbrauchWh = 0, tLadungWh = 0, tNetzWh = 0;
let lastTs = Date.now(), originalMinSoc = null, tempMeldungGesendet = false;
let tSaunaStart = null, tSaunaReset = null, tRadioBad = null, tTuerWarn = null;

// --- 2. AUTO-INIT ---
async function initSystem() {
    const states = [
        { id: PATH_PV + "Hausverbrauch", unit: "W", def: 0 },
        { id: PATH_PV + "Netzbezug", unit: "W", def: 0 },
        { id: PATH_PV + "Einspeisung", unit: "W", def: 0 },
        { id: PATH_PV + "Autarkie", unit: "%", def: 0 },
        { id: PATH_PV + "Tagesverbrauch", unit: "Wh", def: 0 },
        { id: PATH_PV + "Tageserzeugung", unit: "Wh", def: 0 },
        { id: PATH_PV + "Tagesladung", unit: "Wh", def: 0 },
        { id: PATH_PV + "TagesNetzbezug", unit: "Wh", def: 0 },
        { id: PATH_PV + "lade_kwh", unit: "kWh", def: 0 },
        { id: PATH_PV + "Restladezeit", unit: "", def: "n. n." },
        { id: PATH_PV + "Restladezeit_final", unit: "", def: "n. n." }
    ];
    for (const s of states) { 
        if (!existsState(s.id)) {
            await createStateAsync(s.id, s.def, { type: typeof s.def, unit: s.unit }); 
        }
    }
    sMax = (getState(IDS.speicherMax).val) || 9.6;
    tVerbrauchWh = (getState(PATH_PV + "Tagesverbrauch").val) || 0;
    tLadungWh = (getState(PATH_PV + "Tagesladung").val) || 0;
    tNetzWh = (getState(PATH_PV + "TagesNetzbezug").val) || 0;
    console.log("[Master] v2.5 bereit.");
}
initSystem();

// --- 3. HILFSFUNKTIONEN ---
function formatMins(m) { 
    if (isNaN(m) || m <= 0 || !isFinite(m)) return "n. n."; 
    return Math.floor(m / 60) + ":" + ((m % 60) < 10 ? "0" + Math.floor(m % 60) : Math.floor(m % 60)); 
}

function announce(t) { 
    SAYIT_INSTANCES.forEach(function(i) { sendTo(i, "say", { text: t, volume: 70 }); }); 
}

function notify(title, msg, prio) {
    prio = prio || 1;
    sendTo("telegram", "send", { text: msg });
    let token = getState(GOTIFY_TOKEN_ID).val;
    if (token) {
        let url = "https://" + GOTIFY_SERVER + "/message?token=" + token;
        httpPost(url, { title: title, message: msg, priority: prio });
    }
}

function getBereinigteLast() {
    let totalHausV = (Number(getState(PATH_PV + "Hausverbrauch").val) || 0);
    let sumAbzug = 0; 
    IDS.verbraucherWatt.forEach(function(id) { sumAbzug += (Number(getState(id).val) || 0); });
    
    if (getState(IDS.wallboxStatus).val === "Charging") {
        let currentLimitVal = Number(getState(IDS.wallboxCurrentLimit).val) || 60;
        let dynamicWallboxWatt = (currentLimitVal / 10) * 230 * 3; 
        sumAbzug += dynamicWallboxWatt;
    }
    return totalHausV - sumAbzug;
}

// --- 4. HAUPT-LOGIK ---
function runMasterUpdate() {
    let now = Date.now();
    let diff = now - lastTs;
    if (diff < 100) return;

    let hausV = pvP + netP - batP; if (hausV < 0) hausV = 0;
    let h = diff / 3600000;
    tVerbrauchWh += (hausV * h);
    if (batP > 0) tLadungWh += (batP * h); if (netP > 0) tNetzWh += (netP * h);
    lastTs = now;

    let lKWh = (sMax * soc) / 100;
    let fUm = "n. n.", rMin = 0;
    if (batP > 50) {
        let rSec = ((sMax - lKWh) / (batP / 1000)) * 3600;
        rMin = rSec / 60;
        let t = new Date(); t.setSeconds(t.getSeconds() + rSec); fUm = formatDate(t, "hh:mm");
    }

    let curAut = hausV > 0 ? Math.round(Math.min(100, (1 - ((netP > 0 ? netP : 0) / hausV)) * 100)) : 0;

    setState(PATH_PV + "Hausverbrauch", Math.round(hausV), true);
    setState(PATH_PV + "Netzbezug", Math.max(0, Math.round(netP)), true);
    setState(PATH_PV + "Einspeisung", Math.abs(Math.min(0, Math.round(netP))), true);
    setState(PATH_PV + "Autarkie", curAut, true);
    setState(PATH_PV + "lade_kwh", parseFloat(lKWh.toFixed(1)), true);
    setState(PATH_PV + "Restladezeit", formatMins(rMin), true);
    setState(PATH_PV + "Restladezeit_final", fUm, true);

    let bLast = getBereinigteLast();
    let sL = getState(IDS.saunaLogik).val;
    
    if (bLast > SAUNA_POWER) {
        if (!sL && !tSaunaStart) {
            tSaunaStart = setTimeout(function() { if (getBereinigteLast() > SAUNA_POWER) { startSauna(getBereinigteLast()); } tSaunaStart = null; }, 30000);
        } else if (sL) { 
            let aSoc = getState(IDS.batSoc).val; 
            if (aSoc > getState(IDS.minSocRead).val) setState(IDS.minSocSet, aSoc); 
        }
    } else if (bLast < 1000) {
        if (sL && !tempMeldungGesendet && !tSaunaReset) { 
            tempMeldungGesendet = true; 
            notify("Sauna", "Zieltemperatur erreicht!"); 
            announce("Die Sauna ist jetzt heiss."); 
        }
        stopSauna();
    }
}

function startSauna(watt) {
    if (isNaN(watt)) watt = 8000;
    setState(IDS.saunaLogik, true, true); tempMeldungGesendet = false;
    originalMinSoc = getState(IDS.minSocRead).val; setState(IDS.minSocSet, getState(IDS.batSoc).val);
    notify("Sauna", "Sauna eingeschaltet.");
    tRadioBad = setTimeout(function() { setState(IDS.heos.badSender, RADIO_SENDER); setState(IDS.heos.badStatus, true); }, 900000);
}

function stopSauna() {
    if (!getState(IDS.saunaLogik).val || tSaunaReset) return;
    tSaunaReset = setTimeout(function() {
        if (originalMinSoc !== null) setState(IDS.minSocSet, originalMinSoc);
        setState(IDS.heos.saunaStatus, false); setState(IDS.heos.badStatus, false); setState(IDS.saunaLogik, false, true);
        tSaunaReset = null;
    }, 2100000);
}

// --- 5. ASTRO-REPORT ---
schedule({astro: "sunset"}, function() {
    let yieldKWh = getState(IDS.pvYieldToday).val || 0; 
    let dAut = (tVerbrauchWh > 0) ? Math.round((1 - (tNetzWh / tVerbrauchWh)) * 100) : 0;
    let msg = "PV-Tagesbericht: Erzeugung " + yieldKWh.toFixed(2) + " kWh, Haus " + (tVerbrauchWh/1000).toFixed(2) + " kWh, Autarkie " + dAut + "%";
    notify("PV-Tagesbericht", msg);
});

// --- 6. TRIGGER ---
on({id: IDS.pvPower, change: "ne"}, function(obj) { pvP = Number(obj.state.val) || 0; runMasterUpdate(); });
on({id: IDS.netPower, change: "ne"}, function(obj) { netP = Number(obj.state.val) || 0; runMasterUpdate(); });
on({id: IDS.batPower, change: "ne"}, function(obj) { batP = Number(obj.state.val) || 0; runMasterUpdate(); });
on({id: IDS.batSoc, change: "ne"}, function(obj) { soc = Number(obj.state.val) || 0; });
on({id: IDS.saunaTuer, change: "ne"}, function(obj) {
    if (obj.state.val === true && getState(IDS.saunaLogik).val) {
        tTuerWarn = setTimeout(function() { if (getState(IDS.saunaTuer).val && getState(IDS.saunaLogik).val) { announce("Achtung! Die Saunatur ist offen!"); notify("Sauna Alarm", "Tuer offen!"); } }, 60000);
    } else if (tTuerWarn) { clearTimeout(tTuerWarn); tTuerWarn = null; }
});

setInterval(function() {
    let yieldWh = (getState(IDS.pvYieldToday).val || 0) * 1000;
    setState(PATH_PV + "Tageserzeugung", Math.round(yieldWh), true);
    setState(PATH_PV + "Tagesverbrauch", Math.round(tVerbrauchWh), true);
    setState(PATH_PV + "Tagesladung", Math.round(tLadungWh), true);
    setState(PATH_PV + "TagesNetzbezug", Math.round(tNetzWh), true);
}, 10000);

schedule("0 0 * * *", function() { tVerbrauchWh = 0; tLadungWh = 0; tNetzWh = 0; });
