// --- KONFIGURATION ---
const dpBatteryTemp = "modbus.0.inputRegisters.225.262_Battery_temp";
const gotifyToken   = getState("0_userdata.0.gotifytoken.iobroker")?.val;
const TEMP_LIMIT    = 350; // Entspricht 35,0 °C

// --- HILFSFUNKTION (Lokale Meldung) ---
function tempNotify(msg) {
    sendTo("telegram", "send", { text: msg });
    console.log(`Batterie-Warnung: ${msg}`);
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker: Batterie" -F "message=${msg}" -F "priority=8"`);
}

// --- LOGIK ---
on({ id: dpBatteryTemp, change: "ne" }, (obj) => {
    const rawTemp = obj.state.val;
    const oldRawTemp = obj.oldState.val;

    // Prüfung: Limit überschritten? (Flanken-Erkennung, damit nicht bei jedem Grad gewarnt wird)
    if (rawTemp > TEMP_LIMIT && oldRawTemp <= TEMP_LIMIT) {
        
        // Umrechnung: 350 -> 35.0
        const celsius = Math.round((rawTemp / 10) * 10) / 10;
        
        const warnMsg = `+++ 🥵 Die Batterietemperatur liegt bei ${celsius} °C. +++`;
        tempNotify(warnMsg);
    }
});