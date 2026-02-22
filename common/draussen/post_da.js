/**
 * =============================================================================
 * POSTKASTEN-MONITOR v2.4.1
 * =============================================================================
 * ZWECK: Überwachung des Briefkastens mit Voice-Resume und Scharfschaltung.
 * FIX: Syntax-Fehler (Z. 112) behoben und Code-Struktur bereinigt.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const WARTEZEIT_RESUME_MS = 8000; // Zeit bis Musik nach Ansage weiterläuft
const POSTKASTEN_STATE_ID = 'alias.0.draussen.postkasten.STATE'; 
const POSTKASTEN_VIS_ID   = '0_userdata.0.Haushalt.Briefkasten'; 
const GOTIFY_TOKEN_ID     = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_URL          = "https://mygotify.meistermopper.de/message?token=";

// Sperren zur Vermeidung von Mehrfach-Meldungen
let Sperre = false;       
let Sperre_stumm = false; 

/**
 * --- 2. GOOGLE-ANSAGE FUNKTION ---
 * Pausiert Chromecasts, macht die Ansage und setzt Musik fort.
 */
async function googleWatchdogAnnounce(text, vol) {
    const players = $(`chromecast.0.*.status.playerState`);
    
    players.each(async function(id) {
        const base = id.split('.status.')[0]; 
        const isPlaying = (getState(id).val === 'playing');
        
        let oldVol, oldUrl;
        
        // Status sichern
        if (isPlaying) {
            oldVol = getState(base + '.player.volume').val;
            oldUrl = getState(base + '.player.url2play').val;
        }

        // Ansage über SayIt triggern
        sendTo("sayit", "say", { text: text, volume: vol });

        // Musik fortsetzen (Resume)
        if (isPlaying) {
            setStateDelayed(base + '.player.url2play', oldUrl, WARTEZEIT_RESUME_MS, false);
            setStateDelayed(base + '.player.volume', oldVol, WARTEZEIT_RESUME_MS + 500, false);
        }
    });
}

/**
 * --- 3. TRIGGER: POST IST DA ---
 * Reagiert auf den Briefkastensensor.
 */
on({ id: POSTKASTEN_STATE_ID, change: 'ne' }, async (obj) => {
    // Nur bei "wahr" reagieren und wenn nicht bereits als voll markiert
    if (!obj.state || !obj.state.val) return;
    if (getState(POSTKASTEN_VIS_ID).val === true) return;

    const gotifyToken = getState(GOTIFY_TOKEN_ID).val;
    
    // Botschaften trennen: msgText für Handy, msgVoice für Lautsprecher
    const msgText  = '📫 Es war gerade jemand am Postkasten.'; 
    const msgVoice = 'Es war gerade jemand am Postkasten.';    

    // FALL A: Tagsüber mit Ansage (08:00 - 20:00 Uhr)
    if (!Sperre && compareTime('08:00', '20:00', 'between', null)) {
        Sperre = true; 
        
        console.log('[Postkasten] Ereignis erkannt: Starte Ansage & Benachrichtigung.');
        
        // Sprachausgabe (Reintext)
        await googleWatchdogAnnounce(msgVoice, 40);

        // Textnachrichten (mit Symbol)
        sendTo('telegram.0', 'send', { text: msgText });
        exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=Postkasten" -F "message=${msgText}" -F "priority=1"`);

        setTimeout(() => { Sperre = false; }, 60000); // 1 Min Sperre
    } 
    // FALL B: Nachts oder während Sperre (Nur Text)
    else if (!Sperre_stumm) {
        Sperre_stumm = true;
        
        sendTo('telegram.0', 'send', { text: msgText });
        exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=Postkasten" -F "message=${msgText}" -F "priority=5"`);
        
        // Status in VIS auf voll setzen
        setState(POSTKASTEN_VIS_ID, true);
        
        setTimeout(() => { Sperre_stumm = false; }, 60000);
    }
});

/**
 * --- 4. TRIGGER: SCHARFSCHALTUNG NACH LEERUNG ---
 * Reagiert, wenn du in VIS den Button auf "false" setzt.
 */
on({ id: POSTKASTEN_VIS_ID, change: 'ne' }, async (obj) => {
    // Nur reagieren, wenn der Kasten geleert wurde (Status wechselt auf false)
    if (obj.state.val === false) {
        const gotifyToken = getState(GOTIFY_TOKEN_ID).val;
        const msgScharf = '📪 Der Briefkasten wurde wieder scharfgeschaltet.';
        
        // Nur Textnachricht senden
        sendTo('telegram.0', 'send', { text: msgScharf });
        exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=Postkasten" -F "message=${msgScharf}" -F "priority=1"`);
        
        console.log('[Postkasten] System nach Leerung wieder scharfgeschaltet.');
    }
});