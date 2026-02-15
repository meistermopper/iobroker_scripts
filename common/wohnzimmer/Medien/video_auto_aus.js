// --- KONFIGURATION ---
const ID_ACTIVITY_SAT    = 'harmony.0.Harmony_Wozi.activities.SAT_TV';
const ID_ACTIVITY_CHROME = 'harmony.0.Harmony_Wozi.activities.Chromecast_Video';
const GOTIFY_TOKEN_ID    = '0_userdata.0.gotifytoken.iobroker';

// Hilfsfunktion für Benachrichtigungen (spart Code-Wiederholung)
function notify(text, priority = 1) {
    // Telegram
    sendTo('telegram', 'send', { text: text });
    console.log(`[Safety-Off] ${text}`);

    // Gotify
    const token = getState(GOTIFY_TOKEN_ID).val;
    if (token) {
        const curlCmd = `curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker Safety" -F "message=${text}" -F "priority=${priority}"`;
        exec(curlCmd);
    }
}

// --- ZEITPLÄNE ---

// Um Mitternacht: SAT-TV prüfen
schedule("0 0 * * *", async () => {
    if (getState(ID_ACTIVITY_SAT).val === 2) {
        setState(ID_ACTIVITY_SAT, 0);
        notify('+++📡 SAT activity wurde automatisch ausgeschaltet +++', 5);
    }
});

// Um 03:01 Uhr: Chromecast prüfen
schedule("1 3 * * *", async () => {
    if (getState(ID_ACTIVITY_CHROME).val > 0) {
        setState(ID_ACTIVITY_CHROME, 0);
        notify('+++ ⚙️ Chromecast activity wurde automatisch ausgeschaltet +++', 1);
    }
});