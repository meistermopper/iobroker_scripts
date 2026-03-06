// --- KONFIGURATION ---
const ID_WAN_IP = 'unifi-network.0.devices.78:45:58:c7:61:75.ip';
const ID_AKTUELL_IP = '0_userdata.0.System.aktuelle_IP';
const ID_DDNSS_KEY = '0_userdata.0.Unifi.ddnss_key';
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';

const IP_FAILOVER = '192.168.0.27'; // Dein Backup-Gateway
const IP_INTERNAL_GATEWAY = '192.168.1.1';

let failover = false;
let startZeit = 0;

// --- LOGIK ---

on({ id: ID_WAN_IP, change: 'ne' }, async (obj) => {
    const neueIP = obj.state.val;
    const alteIP = obj.oldState.val;
    const gespeicherteIP = getState(ID_AKTUELL_IP).val;

    if (!neueIP || neueIP === '0.0.0.0' || neueIP === IP_INTERNAL_GATEWAY) return;

    // --- FALL 1: Einstieg in Failover ---
    if (neueIP === IP_FAILOVER) {
        startZeit = Date.now();
        failover = true;
        sendAlert("+++ 🌐 Internet-Failover aktiviert! +++");
        return;
    }

    // --- FALL 2: Rückkehr aus Failover oder normaler Wechsel ---
    if (neueIP !== gespeicherteIP && neueIP !== IP_FAILOVER) {
        
        // DDNS Update ausführen
        const ddnssKey = getState(ID_DDNSS_KEY).val;
        const ddnssUrl = `https://www.ddnss.de/upd.php?key=${ddnssKey}&host=all`;
        
        exec(`curl -s "${ddnssUrl}"`);
        console.warn(`DDNS Update gesendet für IP: ${neueIP}`);

        let message = `🌐 Neue IP zugeteilt: ${neueIP}\nDDNS wurde aktualisiert.`;

        if (failover) {
            const dauerMs = Date.now() - startZeit;
            const dauerText = dauerMs < 60000 
                ? `${Math.round(dauerMs / 1000)} Sekunden` 
                : `${(dauerMs / 60000).toFixed(1)} Minuten`;
            
            message = `+++ 🌐 Internet wieder stabil nach ${dauerText}. \nNeue IP: ${neueIP} +++`;
            failover = false;
        }

        sendAlert(message);
        setState(ID_AKTUELL_IP, neueIP, true);
    }
});

// Hilfsfunktion für Benachrichtigungen
function sendAlert(text) {
    sendTo('telegram', 'send', { text: text });
    
    const token = getState(ID_GOTIFY_TOKEN).val;
    const gotifyUrl = `https://mygotify.meistermopper.de/message?token=${token}`;
    exec(`curl -s "${gotifyUrl}" -F "title=ioBroker System" -F "message=${text}" -F "priority=1"`);
    
    console.log(`System-Meldung: ${text}`);
}