// --- KONFIGURATION ---
const AP_DEVICES = [
    { id: 'e0:63:da:73:b5:4a', name: 'Obergeschoss' },
    { id: 'e0:63:da:73:b5:4c', name: 'Keller' }
];

const BASE_PATH = 'unifi-network.0.devices';
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';

// Hilfsfunktion für Benachrichtigungen (Telegram & Gotify)
function notify(text, priority = 1) {
    sendTo('telegram', 'send', { text: text });
    
    const token = getState(GOTIFY_TOKEN_ID).val;
    const url = `https://mygotify.meistermopper.de/message?token=${token}`;
    exec(`curl -s "${url}" -F "title=ioBroker AP-Manager" -F "message=${text}" -F "priority=${priority}"`);
    
    console.log(`AP-Manager: ${text}`);
}

// --- LOGIK 1: FEHLER-ÜBERWACHUNG ---
const errorIds = AP_DEVICES.map(ap => `${BASE_PATH}.${ap.id}.hasError`);

on({ id: errorIds, change: 'ne' }, (obj) => {
    // Wenn hasError ungleich 0 (oder true) ist
    if (obj.state.val !== 0) {
        const ap = AP_DEVICES.find(a => obj.id.includes(a.id));
        notify(`⚠️ Der Accesspoint ${ap.name} (${ap.id}) benötigt Aufmerksamkeit!`, 5);
    }
});

// --- LOGIK 2: GEPLANTER NEUSTART (Täglich 02:29 Uhr) ---
schedule("29 2 * * *", () => {
    AP_DEVICES.forEach((ap, index) => {
        // Zeitversetzt neustarten (0 Min, 5 Min, 10 Min...)
        setTimeout(() => {
            setState(`${BASE_PATH}.${ap.id}.restart`, true);
            notify(`🛜 AP ${ap.name} wurde planmäßig neu gestartet.`, 1);
        }, index * 300000); 
    });
});