// =============================================================================
// UNIVERSAL MASTER v2.6.1 (TYPE-SAFE & STRATEGY EDITION)
// =============================================================================
// Zentrale Steuerung für PV, Batterie, Wallbox und Sauna.
// Dieses Skript koordiniert die Energieverteilung auf deiner VM 101.

// --- 1. KONFIGURATION (Datenpunkt-Adressbuch) ---
const PATH_PV = "0_userdata.0.Energie.PV.";
const PATH_SAUNA = "0_userdata.0.Haushalt.";

const IDS = {
    pvP: "solax.0.data.acpower",
    pvY: "solax.0.data.yieldtoday",
    net: "smartmeter.0.1-0:16_7_0__255.value",
    batP: "modbus.0.inputRegisters.100.842_Battery_Power_(System)",
    soc: "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)",
    sMax: "0_userdata.0.Energie.PV.Speichergroesse",
    sLog: PATH_SAUNA + "sauna_laeuft",
    sTuer: "alias.0.sauna.tuer.opened",
    mSocS: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
    mSocR: "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
    wbSt: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status",
    wbLim: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.configuration.evb_MaximumStationCurrent"
};

// Globale Variablen für Echtzeit-Werte
let pvPower = 0, netPower = 0, batPower = 0, batSoc = 0, speicherMax = 0;
let tVerbrauchWh = 0, tLadungWh = 0, tNetzWh = 0, lastTs = Date.now();
let originalMinSoc = null, tSaunaStart = null, tSaunaReset = null;

// --- 2. AUTO-INIT (Systemstart & Typ-Sicherheit) ---
async function initSystem() {
    // Hier definieren wir exakt, welcher Punkt welchen Typ (number/boolean) hat
    const states = [
        { id: PATH_PV + "Hausverbrauch", unit: "W", type: "number" },
        { id: PATH_PV + "Netzbezug", unit: "W", type: "number" },
        { id: PATH_PV + "Einspeisung", unit: "W", type: "number" },
        { id: PATH_PV + "Autarkie", unit: "%", type: "number" },
        { id: PATH_PV + "Tagesverbrauch", unit: "Wh", type: "number" },
        { id: PATH_PV + "Tageserzeugung", unit: "Wh", type: "number" },
        { id: PATH_PV + "Tagesladung", unit: "Wh", type: "number" },
        { id: PATH_PV + "TagesNetzbezug", unit: "Wh", type: "number" },
        { id: PATH_PV + "lade_kwh", unit: "kWh", type: "number" },
        { id: PATH_PV + "Restladezeit", unit: "", type: "string" },
        { id: PATH_PV + "Restladezeit_final", unit: "", type: "string" },
        { id: PATH_PV + "Wallbox_Freigabe", unit: "", type: "boolean" } // JETZT KORREKT ALS BOOLEAN
    ];

    for (let s of states) {
        if (!existsState(s.id)) {
            await createStateAsync(s.id, s.type === "boolean" ? false : 0, { 
                type: s.type, 
                unit: s.unit,
                name: s.id.split('.').pop() 
            });
        }
    }
    
    // Bestehende Werte einlesen, damit Zähler nicht bei 0 starten
    speicherMax = getState(IDS.sMax).val || 9.6;
    tVerbrauchWh = getState(PATH_PV + "Tagesverbrauch").val || 0;
    tLadungWh = getState(PATH_PV + "Tagesladung").val || 0;
    tNetzWh = getState(PATH_PV + "TagesNetzbezug").val || 0;
    console.log("[Master] v2.6.1 (Typ-Fix) bereit.");
}
initSystem();

// --- 3. HILFSFUNKTIONEN (Logik-Werkzeuge) ---

// Berechnet die "Nutzlast" des Hauses ohne Großverbraucher und ohne Wallbox
function getBereinigteLast() {
    let hausV = Number(getState(PATH_PV + "Hausverbrauch").val) || 0;
    let abzug = 0;
    
    // Großverbraucher einzeln abfragen (Linearer Stil für Stabilität)
    let g1 = getState("alias.0.kueche.boiler.ENERGY_Power").val; if (g1) abzug += Number(g1);
    let g2 = getState("alias.0.kueche.geschirr.ENERGY_Power").val; if (g2) abzug += Number(g2);
    let g3 = getState("alias.0.waschen.wasch.ENERGY_Power").val; if (g3) abzug += Number(g3);
    let g4 = getState("alias.0.waschen.trocknen.ENERGY_Power").val; if (g4) abzug += Number(g4);
    let g5 = getState("alias.0.kueche.backofen.ENERGY_Power").val; if (g5) abzug += Number(g5);

    // Wallbox-Leistung dynamisch berechnen
    if (getState(IDS.wbSt).val === "Charging") {
        let lim = Number(getState(IDS.wbLim).val) || 60;
        abzug += (lim / 10) * 230 * 3;
    }
    return (hausV - abzug);
}

// Prüft die Sommer-Strategie: April-Sept, nach 14 Uhr, SoC > 85%
function checkSommerStrategie() {
    const d = new Date();
    const monat = d.getMonth(); // 3 = April, 8 = Sept
    const stunde = d.getHours();
    
    // Logik: Ist Sommerhalbjahr UND Nachmittag UND Batterie ausreichend voll?
    const freigabe = (monat >= 3 && monat <= 8 && stunde >= 14 && batSoc >= 85);
    
    // Schreibt das Ergebnis (true/false) in den Datenpunkt
    setState(PATH_PV + "Wallbox_Freigabe", freigabe, true);
    return freigabe;
}

// Benachrichtigungssystem
function notify(title, msg) {
    sendTo("telegram", "send", { text: msg });
    let tok = getState("0_userdata.0.gotifytoken.iobroker").val;
    if (tok) {
        httpPost("https://mygotify.meistermopper.de/message?token=" + tok, { 
            title: title, message: msg, priority: 1 
        });
    }
}

// --- 4. HAUPT-LOGIK (Rechenzentrum) ---
function runUpdate() {
    let now = Date.now();
    let diff = now - lastTs;
    if (diff < 100) return;

    // Physik: Hausverbrauch = Erzeugung + Netzbezug - Batterieleistung
    let curHausV = pvPower + netPower - batPower;
    if (curHausV < 0) curHausV = 0;

    // Integration: Leistung über Zeit in Arbeit (Wh) umrechnen
    let h = diff / 3600000;
    tVerbrauchWh += (curHausV * h);
    if (batPower > 0) tLadungWh += (batPower * h);
    if (netPower > 0) tNetzWh += (netPower * h);
    lastTs = now;

    // Batterie-Metriken (Rest-kWh und Ladezeit)
    let curKwh = (speicherMax * batSoc) / 100;
    let rMin = 0, fUm = "n. n.";
    if (batPower > 50) {
        let rSec = ((speicherMax - curKwh) / (batPower / 1000)) * 3600;
        rMin = rSec / 60;
        let t = new Date(); t.setSeconds(t.getSeconds() + rSec); fUm = formatDate(t, "hh:mm");
    }

    // Autarkie-Berechnung
    let aut = curHausV > 0 ? Math.round(Math.min(100, (1 - (Math.max(0, netPower) / curHausV)) * 100)) : 0;

    // Datenpunkte für VIS schreiben
    setState(PATH_PV + "Hausverbrauch", Math.round(curHausV), true);
    setState(PATH_PV + "Netzbezug", Math.max(0, Math.round(netPower)), true);
    setState(PATH_PV + "Einspeisung", Math.abs(Math.min(0, Math.round(netPower))), true);
    setState(PATH_PV + "Autarkie", aut, true);
    setState(PATH_PV + "lade_kwh", parseFloat(curKwh.toFixed(1)), true);
    setState(PATH_PV + "Restladezeit_final", fUm, true);

    // Sommer-Strategie ausführen
    checkSommerStrategie();

    // Sauna-Schutzlogik
    let bL = getBereinigteLast();
    let sL = getState(IDS.sLog).val;

    if (bL > 7500) { // Wenn Last > 7.5kW (Sauna heizt)
        if (!sL && !tSaunaStart) {
            tSaunaStart = setTimeout(function() {
                if (getBereinigteLast() > 7500) { startSauna(); }
                tSaunaStart = null;
            }, 30000);
        } else if (sL) {
            // Min-SoC auf aktuellen SoC heben, um Batterie-Entladung für Sauna zu stoppen
            if (batSoc > getState(IDS.mSocR).val) setState(IDS.mSocS, batSoc);
        }
    } else if (bL < 1000 && sL && !tSaunaReset) {
        stopSauna();
    }
}

function startSauna() {
    setState(IDS.sLog, true, true);
    originalMinSoc = getState(IDS.mSocR).val;
    setState(IDS.mSocS, batSoc);
    notify("Sauna", "Priorisierung aktiv. Batterie wird geschont.");
}

function stopSauna() {
    tSaunaReset = setTimeout(function() {
        if (originalMinSoc !== null) setState(IDS.mSocS, originalMinSoc);
        setState(IDS.sLog, false, true);
        tSaunaReset = null;
    }, 2100000);
}

// --- 5. TRIGGER (Sensoren) ---
on({id: IDS.pvP, change: "ne"}, function(obj) { pvPower = obj.state.val || 0; runUpdate(); });
on({id: IDS.net, change: "ne"}, function(obj) { netPower = obj.state.val || 0; runUpdate(); });
on({id: IDS.batP, change: "ne"}, function(obj) { batPower = obj.state.val || 0; runUpdate(); });
on({id: IDS.soc, change: "ne"}, function(obj) { batSoc = obj.state.val || 0; });

// Statistik-Update alle 10 Sekunden
setInterval(function() {
    let yWh = (getState(IDS.pvY).val || 0) * 1000;
    setState(PATH_PV + "Tageserzeugung", Math.round(yWh), true);
    setState(PATH_PV + "Tagesverbrauch", Math.round(tVerbrauchWh), true);
    setState(PATH_PV + "Tagesladung", Math.round(tLadungWh), true);
    setState(PATH_PV + "TagesNetzbezug", Math.round(tNetzWh), true);
}, 10000);

// Tages-Reset um Mitternacht
schedule("0 0 * * *", function() { tVerbrauchWh = 0; tLadungWh = 0; tNetzWh = 0; });