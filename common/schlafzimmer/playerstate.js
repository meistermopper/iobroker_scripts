// =============================================================================
// MONITOR: GOOGLE MINI SCHLAFZIMMER
// =============================================================================

// --- KONFIGURATION ---
const ID_DEVICE_CONNECTED = 'chromecast.0.f0ef862c5b50.status.connected';
const INSTANCE_TELEGRAM   = 'telegram.0';
const GOTIFY_SERVER       = 'mygotify.meistermopper.de';
const ID_GOTIFY_TOKEN     = '0_userdata.0.gotifytoken.iobroker';

let miniTimeout = null;

// --- HILFSFUNKTION: GOTIFY DIREKT ---
function sendToGotify(title, message, priority) {
    const token = getState(ID_GOTIFY_TOKEN).val;
    if (!token) {
        console.warn('Gotify-Monitor: Kein Token in ' + ID_GOTIFY_TOKEN + ' gefunden!');
        return;
    }

    const url = `https://${GOTIFY_SERVER}/message?token=${token}`;
    const body = {
        title: title,
        message: message,
        priority: priority
    };

    httpPost(url, body, (err, response) => {
        if (err) console.error('Gotify Fehler: ' + err);
    });
}

// --- MONITOR LOGIK ---
on({ id: ID_DEVICE_CONNECTED, change: 'ne' }, (obj) => {
    // Falls das Gerät offline geht (val == false)
    if (!obj.state.val) {
        if (!miniTimeout) {
            console.log('Google Mini offline erkannt. Starte 2-Minuten-Timer...');
            
            miniTimeout = setTimeout(() => {
                miniTimeout = null;
                
                // Nach 2 Minuten prüfen: Ist es immer noch offline?
                if (!getState(ID_DEVICE_CONNECTED).val) {
                    const notifyText = '⚠️ Der Google Mini im Schlafzimmer hat seit zwei Minuten keine WLAN-Verbindung.';
                    
                    // 1. Telegram senden
                    sendTo(INSTANCE_TELEGRAM, 'send', { text: notifyText });
                    
                    // 2. Gotify senden
                    sendToGotify('ioBroker Status', notifyText, 1);
                    
                    // 3. Log-Eintrag
                    console.warn(notifyText);
                }
            }, 120000); // 120.000 ms = 2 Minuten
        }
    } else {
        // Falls das Gerät innerhalb der 2 Minuten wieder online geht
        if (miniTimeout) {
            console.log('Google Mini rechtzeitig wieder online. Benachrichtigung abgebrochen.');
            clearTimeout(miniTimeout);
            miniTimeout = null;
        }
    }
});