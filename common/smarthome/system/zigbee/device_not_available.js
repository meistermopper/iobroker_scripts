/**
 * SKRIPT: Zigbee Availability Monitor (V2026)
 * * ZWECK:
 * Überwacht die Erreichbarkeit aller Zigbee-Geräte und meldet Ausfälle.
 * * FEATURES:
 * - Smart-Naming: Erkennt Klarnamen statt kryptischer IDs.
 * - Anti-Spam: Meldet erst, wenn ein Gerät länger als 30 Sek. offline ist.
 * - Hybrid-Benachrichtigung: Telegram & Gotify integriert.
 * - Ignorier-Liste: Für Geräte, die man manuell stromlos schaltet.
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
    // Geräte-Namen, die keine Meldung auslösen sollen
    ignoreList: ['Testgeraet_1', 'Alte_Lampe', 'Deko_Leuchte_Advent'],
    
    // Zeitpuffer in Millisekunden (30 Sek). 
    // Verhindert Alarme bei ganz kurzen Funklöchern.
    offlineThreshold: 30000, 
    
    services: {
        useTelegram: true,
        useGotify: true,
        // Pfad zu deinem Gotify-Token (aus deinem Akku-Skript übernommen)
        idGotifyToken: "0_userdata.0.gotifytoken.iobroker"
    }
};

// Interner Speicher für die Zeitpuffer
let activeTimers = {};

// --- 2. HILFSFUNKTIONEN ---

/**
 * Funktion: getDeviceName
 * ZWECK: Sucht den lesbaren Namen des Zigbee-Geräts.
 */
function getDeviceName(obj) {
    if (obj.channelName && obj.channelName !== 'N/A') return obj.channelName;
    
    // Fallback: Versuche den Namen aus dem Objekt-Baum zu lesen
    const parts = obj.id.split('.');
    if (parts.length >= 3) {
        const deviceId = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const deviceObj = getObject(deviceId);
        if (deviceObj?.common?.name) {
            return typeof deviceObj.common.name === 'object' 
                ? (deviceObj.common.name.de || deviceObj.common.name.en) 
                : deviceObj.common.name;
        }
    }
    return 'Unbekanntes Gerät';
}

/**
 * Funktion: sendAlert
 * ZWECK: Schickt die Nachricht über alle aktiven Kanäle.
 */
async function sendAlert(msg) {
    console.warn(msg);
    
    if (CONFIG.services.useTelegram) {
        sendTo('telegram', 'send', { text: msg });
    }
    
    if (CONFIG.services.useGotify) {
        const tokenState = await getStateAsync(CONFIG.services.idGotifyToken);
        if (tokenState?.val) {
            // Hier wird deine Gotify-URL genutzt
            exec(`curl "https://mygotify.meistermopper.de/message?token=${tokenState.val}" -F "title=Zigbee Alarm" -F "message=${msg}" -F "priority=1"`);
        }
    }
}

// --- 3. ÜBERWACHUNGS-LOGIK ---

// Trigger: Reagiert auf alle "available" Datenpunkte im Zigbee-Adapter
on({ id: /^zigbee\.0\..*\.available$/, change: 'ne' }, async (obj) => {
    const isOnline = !!obj.state.val;
    const deviceName = getDeviceName(obj);
    const deviceId = obj.id;

    // 1. Ignorier-Liste prüfen
    if (CONFIG.ignoreList.includes(deviceName)) return;

    if (!isOnline) {
        /**
         * FALL: Gerät geht OFFLINE
         * Wir starten einen Timer. Erst wenn dieser abläuft, wird gemeldet.
         */
        if (!activeTimers[deviceId]) {
            activeTimers[deviceId] = setTimeout(() => {
                const msg = `⚠️ Zigbee-Gerät seit ${CONFIG.offlineThreshold / 1000}s offline: ${deviceName}`;
                sendAlert(msg);
                delete activeTimers[deviceId]; // Timer aufräumen
            }, CONFIG.offlineThreshold);
        }
    } else {
        /**
         * FALL: Gerät geht ONLINE
         * Falls ein "Offline-Alarm-Timer" lief, wird dieser sofort gelöscht (Entprellung).
         */
        if (activeTimers[deviceId]) {
            clearTimeout(activeTimers[deviceId]);
            delete activeTimers[deviceId];
            console.log(`✅ Zigbee-Gerät ${deviceName} hat sich rechtzeitig wieder gemeldet.`);
        } else {
            // Optionale Info im Log, wenn ein Gerät nach längerer Zeit wiederkam
            console.log(`🛎️ Zigbee-Gerät wieder erreichbar: ${deviceName}`);
        }
    }
});