// --- KONFIGURATION ---
const AP_DEVICES = [
    { id: 'e0:63:da:73:b5:4a', name: 'Obergeschoss' },
    { id: 'e0:63:da:73:b5:4c', name: 'Keller' }
];

const BASE_PATH = 'unifi-network.0.devices';

// --- LOGIK 1: FEHLER-ÜBERWACHUNG ---
const errorIds = AP_DEVICES.map(ap => `${BASE_PATH}.${ap.id}.hasError`);

on({ id: errorIds, change: 'ne' }, (obj) => {
    // Wenn hasError ungleich 0 (oder true) ist
    if (obj.state.val !== 0) {
        const ap = AP_DEVICES.find(a => obj.id.includes(a.id)); // Finde den AP, der den Fehler meldet
        sendGlobalNotify(`⚠️ Der Accesspoint ${ap.name} (${ap.id}) benötigt Aufmerksamkeit!`, "AP-Manager", 5);
    }
});

// --- LOGIK 2: GEPLANTER NEUSTART (Täglich 02:29 Uhr) ---
schedule("29 2 * * *", () => {
    AP_DEVICES.forEach((ap, index) => {
        // Zeitversetzt neustarten (0 Min, 5 Min, 10 Min...) und globale Benachrichtigung
        setTimeout(() => { setState(`${BASE_PATH}.${ap.id}.restart`, true); sendGlobalNotify(`🛜 AP ${ap.name} wurde planmäßig neu gestartet.`, "AP-Manager", 1); }, index * 300000);
    });
});
