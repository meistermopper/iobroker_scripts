// --- KONFIGURATION ---
const WARTEZEIT_RESUME_MS = 8000; // Zeitpuffer, bis die Musik nach der Ansage fortgesetzt wird
const POSTKASTEN_STATE_ID = 'alias.0.draussen.postkasten.STATE';
const POSTKASTEN_VIS_ID = '0_userdata.0.Haushalt.Briefkasten';
const GOTIFY_TOKEN_ID = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_URL = "https://mygotify.meistermopper.de/message?token=";

var Sperre = false;
var Sperre_stumm = false;

// --- DYNAMISCHE GOOGLE-ANSAGE FUNKTION ---
// Diese Funktion speichert den Status spielender Geräte und stellt ihn nach der Ansage wieder her.
async function googleWatchdogAnnounce(text, vol) {
    const players = $(`chromecast.0.*.status.playerState`);
    
    players.each(async function(id) {
        const base = id.split('.status.')[0]; 
        const isPlaying = (getState(id).val === 'playing');
        
        let oldVol, oldUrl;
        if (isPlaying) {
            oldVol = getState(base + '.player.volume').val;
            oldUrl = getState(base + '.player.url2play').val;
        }

        // Sprachausgabe über SayIt
        sendTo("sayit", "say", { text: text, volume: vol });

        // Wiederaufnahme nur, wenn es vorher lief
        if (isPlaying) {
            // Wir warten einen Moment, bis die SayIt-Ansage vermutlich beendet ist
            setStateDelayed(base + '.player.url2play', oldUrl, WARTEZEIT_RESUME_MS, false);
            setStateDelayed(base + '.player.volume', oldVol, WARTEZEIT_RESUME_MS + 500, false);
        }
    });
}

// --- TRIGGER POSTKASTEN ---
on({ id: POSTKASTEN_STATE_ID, change: 'ne' }, async (obj) => {
    if (!obj.state || !obj.state.val) return;
    if (getState(POSTKASTEN_VIS_ID).val) return;

    const gotifyToken = getState(GOTIFY_TOKEN_ID).val;
    const msg = '📫 Es war gerade jemand am Postkasten.';

    // A: Lautstarke Ansage (Tagsüber 08:00 - 20:00 Uhr)
    if (!Sperre && compareTime('08:00', '20:00', 'between', null)) {
        Sperre = true;
        
        console.warn('Post da - Lautstarke Ansage mit Resume-Logik');
        await googleWatchdogAnnounce(msg, 40);

        // Benachrichtigungen
        sendTo('telegram.0', 'send', { text: msg });
        exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=ioBroker" -F "message=${msg}" -F "priority=1"`);

        setTimeout(() => { Sperre = false; }, 60000);
    } 
    // B: Stumme Benachrichtigung (Nachts oder während Sperre)
    else if (!Sperre_stumm) {
        Sperre_stumm = true;
        console.log('Post da - Nur Text/Benachrichtigung');
        
        sendTo('telegram.0', 'send', { text: msg });
        exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=ioBroker" -F "message=${msg}" -F "priority=5"`);
        
        setState(POSTKASTEN_VIS_ID, true);
        setTimeout(() => { Sperre_stumm = false; }, 60000);
    }
});

// Meldung Scharfschaltung (Wenn der Briefkasten geleert wurde)
on({ id: POSTKASTEN_VIS_ID, change: 'lt' }, async (obj) => {
    const gotifyToken = getState(GOTIFY_TOKEN_ID).val;
    const msgScharf = '+++📫 Der Briefkasten wurde wieder scharf geschaltet. +++';
    
    sendTo('telegram.0', 'send', { text: msgScharf });
    exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=ioBroker" -F "message=${msgScharf}" -F "priority=1"`);
});