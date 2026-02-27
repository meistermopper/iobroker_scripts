/**
 * Name:    UniFi DynDNS & WAN-Guard
 * Zweck:   Prüft, ob die reale externe IP mit der vom UniFi-Controller gemeldeten IP übereinstimmt.
 * Logik:   Vermeidet Fehlalarme bei Failover-Szenarien und benachrichtigt bei Diskrepanzen.
 */

// --- 1. KONFIGURATION ---
const ID_UNIFI_IP     = 'unifi-network.0.devices.78:45:58:c7:61:75.ip'; // IP laut Controller
const ID_WAN_IP       = 'unifi-network.0.settings.wan.ip';             // Offizielle WAN-IP im Adapter
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';           // Pfad zum Token
const FAILOVER_IP     = '192.168.0.27';                                // Bekannte Failover-IP (wird ignoriert)

let fehlermeldungGesendet = false; // Status-Speicher, um Spam zu verhindern

// --- 2. HILFSFUNKTION (MELDUNGEN) ---
function notify(title, msg, priority = 3) {
    // Telegram Broadcast an alle User
    sendTo('telegram', 'send', { text: `*${title}*\n${msg}`, parse_mode: 'Markdown' });

    // Gotify-Meldung
    const token = getState(ID_GOTIFY_TOKEN).val;
    if (token) {
        const url = `https://mygotify.meistermopper.de/message?token=${token}`;
        // httpPost ist sauberer als exec(curl)
        httpPost(url, { title: title, message: msg, priority: priority }, (error) => {
            if (error) console.error(`[UniFi-Guard] Gotify Fehler: ${error}`);
        });
    }
}

// --- 3. ÜBERWACHUNGS-SCHLEIFE (Alle 30 Minuten) ---
schedule("*/30 * * * *", async () => {
    
    // Schritt A: Echte externe IP via Amazon abfragen (Alternative: https://api.ipify.org)
    httpGet('http://checkip.amazonaws.com', (error, response) => {
        if (error || !response || response.statusCode !== 200) {
            console.error(`[UniFi-Guard] Externer IP-Check fehlgeschlagen: ${error}`);
            return;
        }

        const aktuelleIP = response.data.trim(); // Die wirklich im Internet sichtbare IP
        
        // Schritt B: Prüfen, ob UniFi-Datenpunkte erreichbar sind
        if (!existsState(ID_UNIFI_IP)) {
            console.warn(`[UniFi-Guard] Datenpunkt fehlt: ${ID_UNIFI_IP}. Check die MAC-Adresse!`);
            return;
        }

        const unifiIP = getState(ID_UNIFI_IP).val; // Die IP, die der UniFi-Adapter aktuell meldet
        
        // WAN-IP für die Nachricht auslesen
        let dyndnsIP = existsState(ID_WAN_IP) ? getState(ID_WAN_IP).val : "unbekannt";

        // --- 4. VERGLEICHS-LOGIK ---
        // Wenn die echte IP NICHT der gemeldeten UniFi-IP entspricht...
        // UND die UniFi-IP nicht die bekannte Failover-IP ist...
        if (aktuelleIP !== unifiIP && unifiIP !== FAILOVER_IP) {
            
            // ...und wir noch keine Warnung draußen haben:
            if (!fehlermeldungGesendet) {
                const msg = `⚠️ Dyndns-Abgleich fehlgeschlagen!\n` +
                            `UniFi meldet: ${unifiIP}\n` +
                            `Real extern: ${aktuelleIP}\n` +
                            `WAN-Einstellung: ${dyndnsIP}`;
                
                notify('UniFi Guard', msg, 8);
                fehlermeldungGesendet = true; // Sperre setzen
            }
        } 
        // Falls der Abgleich wieder passt (Heilung):
        else if (fehlermeldungGesendet) {
            notify('UniFi Guard', '✅ IP-Abgleich wieder korrekt. Die externe Erreichbarkeit sollte stabil sein.', 5);
            fehlermeldungGesendet = false; // Sperre aufheben
        }
    });
});