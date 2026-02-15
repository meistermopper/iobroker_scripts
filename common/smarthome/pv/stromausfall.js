// --- KONFIGURATION ---
const dpGridAlarm = "modbus.0.inputRegisters.227.64_Grid_lost_alarm"; // 0=Ok; 2=Alarm
const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker").val;

let ausfallStart;

// --- HILFSFUNKTION (Meldungen) ---
function gridNotify(msg, priority = 5) {
    // Telegram mit HTML-Formatierung für Festbreitenschrift (pre)
    sendTo("telegram", "send", {
        text: `<pre>${msg}</pre>`,
        parse_mode: "HTML"
    });
    
    console.log(`Grid-Alarm: ${msg}`);
    
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker: Netzstatus" -F "message=${msg}" -F "priority=${priority}"`);
}

// --- LOGIK ---
on({ id: dpGridAlarm, change: "ne" }, (obj) => {
    const status = obj.state.val;

    if (status === 2) {
        // NETZAUSFALL START
        ausfallStart = Date.now();
        gridNotify("🔌 Das Stromnetz ist ausgefallen!");

    } else if (status === 0 && ausfallStart) {
        // NETZKEHR
        const dauerMs = Date.now() - ausfallStart;
        const totalMinutes = Math.round(dauerMs / 60000);
        
        // Formatierung HH:MM
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const formatDauer = `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;

        const msg = `🔌 Das Haus ist wieder am Netz.\nDer Stromausfall dauerte ${formatDauer} Std.`;
        gridNotify(msg);
        
        ausfallStart = null; // Reset für den nächsten Ausfall
    }
});