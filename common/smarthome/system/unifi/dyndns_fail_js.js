// --- KONFIGURATION ---
const ID_UNIFI_IP = 'unifi-network.0.devices.78:45:58:c7:61:75.ip';
// Falls dieser Pfad bei dir anders ist, bitte im Objektbaum kopieren:
const ID_WAN_IP   = 'unifi-network.0.settings.wan.ip'; 
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';

let fehlermeldungGesendet = false;

schedule("*/30 * * * *", async () => {
    // Externe IP via Amazon abfragen
    exec('curl -s http://checkip.amazonaws.com', (error, result) => {
        if (error || !result) {
            console.error(`IP-Check fehlgeschlagen (extern): ${error}`);
            return;
        }

        const aktuelleIP = result.trim();
        
        // Prüfen, ob die Datenpunkte überhaupt existieren, um Warnungen zu vermeiden
        if (!existsState(ID_UNIFI_IP)) {
            console.warn(`Datenpunkt fehlt: ${ID_UNIFI_IP}. Prüfe die MAC-Adresse im Pfad!`);
            return;
        }

        const unifiIP = getState(ID_UNIFI_IP).val;
        
        // WAN IP sicher abrufen
        let dyndnsIP = "unbekannt";
        if (existsState(ID_WAN_IP)) {
            dyndnsIP = getState(ID_WAN_IP).val;
        }

        // Prüfung: Weicht die echte externe IP von der Adapter-IP ab?
        // (Und wir ignorieren den Failover-Zustand 192.168.0.27)
        if (aktuelleIP !== unifiIP && unifiIP !== '192.168.0.27') {
            
            if (!fehlermeldungGesendet) {
                const msg = `⚠️ Dyndns-Abgleich fehlgeschlagen!\nWAN-IP (UniFi): ${dyndnsIP}\nReal externe IP: ${aktuelleIP}`;
                
                sendTo('telegram', 'send', { text: msg });
                
                const token = getState(ID_GOTIFY_TOKEN).val;
                const gotifyUrl = `https://mygotify.meistermopper.de/message?token=${token}`;
                exec(`curl -s "${gotifyUrl}" -F "title=UniFi Guard" -F "message=${msg}" -F "priority=1"`);

                console.error(msg);
                fehlermeldungGesendet = true;
            }
        } else {
            if (fehlermeldungGesendet) {
                console.log("✅ IP-Abgleich wieder korrekt. Warnung aufgehoben.");
                fehlermeldungGesendet = false;
            }
        }
    });
});