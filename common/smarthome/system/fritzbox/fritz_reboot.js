// --- KONFIGURATION ---
const dpFritzActive = 'tr-064.0.devices.Fritzbox.active';
const gotifyToken   = getState('0_userdata.0.gotifytoken.iobroker')?.val;
const CHECK_DELAY   = 420000; // 7 Minuten Verzögerung

let fritzTimeout = null;

// --- HILFSFUNKTION (Meldung) ---
function fritzNotify(msg) {
    sendTo('telegram', 'send', { text: msg });
    console.error(`FritzBox-Status: ${msg}`);
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker: Netzwerk" -F "message=${msg}" -F "priority=5"`);
}

// --- LOGIK ---
on({ id: dpFritzActive, change: 'ne' }, (obj) => {
    const active = obj.state.val;

    if (!active) {
        // FritzBox ist offline gegangen -> Timer starten
        console.log(`FritzBox ist offline. Warte ${CHECK_DELAY / 60000} Min auf Wiederkehr...`);
        
        fritzTimeout = setTimeout(() => {
            // Nach Ablauf der Zeit prüfen: Immer noch offline?
            if (!getState(dpFritzActive)?.val) {
                fritzNotify('❌ Die Fritzbox ist offline.');
            }
            fritzTimeout = null;
        }, CHECK_DELAY);

    } else {
        // FritzBox ist wieder online -> Laufenden Timer abbrechen
        if (fritzTimeout) {
            clearTimeout(fritzTimeout);
            fritzTimeout = null;
            console.log('FritzBox wieder online. Alarm abgebrochen.');
        }
    }
});