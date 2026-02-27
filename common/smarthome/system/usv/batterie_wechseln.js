// --- KONFIGURATION ---
const upsServerschrank = 'nut.0.status.replacebattery';
const upsBuero         = 'nut.1.status.replacebattery';
const gotifyToken      = getState("0_userdata.0.gotifytoken.iobroker").val;

// --- HILFSFUNKTION (Meldung) ---
function upsNotify(location) {
    const msg = `+++ 🔋 Die Batterie der USV im ${location} muss ausgetauscht werden! +++`;
    
    sendTo("telegram", "send", { text: msg });
    console.warn(`USV-Alarm: ${msg}`);
    
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker: USV Wartung" -F "message=${msg}" -F "priority=8"`);
}

// --- LOGIK ---
on({ id: [upsServerschrank, upsBuero], change: "gt" }, (obj) => {
    // Falls der Wert von 0 auf 1 (oder höher) springt
    if (obj.state.val > 0) {
        if (obj.id === upsServerschrank) {
            upsNotify("Serverschrank");
        } else if (obj.id === upsBuero) {
            upsNotify("Büro");
        }
    }
});