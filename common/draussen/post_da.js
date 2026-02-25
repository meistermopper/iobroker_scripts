/**
 * =============================================================================
 * POSTKASTEN-MONITOR v2.4.2
 * =============================================================================
 * ZWECK: Überwachung des Briefkastens mit Sprachausgabe und VIS-Status.
 * FIX: VIS-Datenpunkt wird nun auch tagsüber korrekt auf "true" gesetzt.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const WARTEZEIT_RESUME_MS = 8000; // Zeit bis Musik nach Ansage weiterläuft
const POSTKASTEN_STATE_ID = 'alias.0.draussen.postkasten.STATE'; 
const POSTKASTEN_VIS_ID   = '0_userdata.0.Haushalt.Briefkasten'; 
const GOTIFY_TOKEN_ID     = '0_userdata.0.gotifytoken.iobroker';
const GOTIFY_URL          = "https://mygotify.meistermopper.de/message?token=";

// Sperren zur Vermeidung von Mehrfach-Meldungen innerhalb einer Minute
let Sperre = false;        
let Sperre_stumm = false; 

/**
 * --- 2. GOOGLE-ANSAGE FUNKTION ---
 * Sucht alle aktiven Chromecasts, pausiert sie, macht die Ansage
 * und setzt die Musik (falls vorher laufend) fort.
 */
async function googleWatchdogAnnounce(text, vol) {
    const players = $(`chromecast.0.*.status.playerState`);
    
    players.each(async function(id) {
        const base = id.split('.status.')[0]; 
        const isPlaying = (getState(id).val === 'playing');
        
        let oldVol, oldUrl;
        
        // Aktuellen Status sichern, um ihn später wiederherzustellen
        if (isPlaying) {
            oldVol = getState(base + '.player.volume').val;
            oldUrl = getState(base + '.player.url2play').val;
        }

        // Ansage über die SayIt-Instanz triggern
        sendTo("sayit", "say", { text: text, volume: vol });

        // Musik nach der Wartezeit fortsetzen (Resume)
        if (isPlaying) {
            setStateDelayed(base + '.player.url2play', oldUrl, WARTEZEIT_RESUME_MS, false);
            setStateDelayed(base + '.player.volume', oldVol, WARTEZEIT_RESUME_MS + 500, false);
        }
    });
}

/**
 * --- 3. TRIGGER: POST IST DA ---
 * Reagiert auf den Hardware-Sensor am Briefkasten.
 */
on({ id: POSTKASTEN_STATE_ID, change: 'ne' }, async (obj) => {
    // Sicherheits-Check: Nur reagieren, wenn Sensor "wahr" meldet
    if (!obj.state || !obj.state.val) return;
    
    // Wenn in der VIS der Kasten noch als "voll" (true) markiert ist, nichts tun
    if (getState(POSTKASTEN_VIS_ID).val === true) return;

    const gotifyToken = getState(GOTIFY_TOKEN_ID).val;
    const msgText  = '📫 Es war gerade jemand am Postkasten.'; 
    const msgVoice = 'Es war gerade jemand am Postkasten.';    

    // FALL A: Tagsüber (08:00 - 20:00 Uhr) -> Volles Programm mit Ansage
    if (!Sperre && compareTime('08:00', '20:00', 'between', null)) {
        Sperre = true; 
        
        console.log('[Postkasten] Ereignis erkannt: Starte Ansage & VIS-Update.');
        
        // 1. Status in VIS auf "voll" setzen (Das hat in V2.4.1 gefehlt!)
        setState(POSTKASTEN_VIS_ID, true);

        // 2. Sprachausgabe über Google-Geräte
        await googleWatchdogAnnounce(msgVoice, 40);

        // 3. Textnachrichten versenden
        sendTo('telegram.0', 'send', { text: msgText });
        exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=Postkasten" -F "message=${msgText}" -F "priority=1"`);

        // Sperre nach einer Minute wieder aufheben
        setTimeout(() => { Sperre = false; }, 60000); 
    } 
    
    // FALL B: Nachts oder während der aktiven Sperre -> Nur Text-Benachrichtigung
    else if (!Sperre_stumm) {
        Sperre_stumm = true;
        
        console.log('[Postkasten] Stummes Ereignis: Nur VIS-Update & Textnachricht.');

        // Status in VIS auf "voll" setzen
        setState(POSTKASTEN_VIS_ID, true);
        
        sendTo('telegram.0', 'send', { text: msgText });
        exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=Postkasten" -F "message=${msgText}" -F "priority=5"`);
        
        setTimeout(() => { Sperre_stumm = false; }, 60000);
    }
});

/**
 * --- 4. TRIGGER: SCHARFSCHALTUNG NACH LEERUNG ---
 * Reagiert, wenn Du in der VIS das Paket-Symbol anklickst (Status wird false).
 */
on({ id: POSTKASTEN_VIS_ID, change: 'ne' }, async (obj) => {
    // Wir reagieren nur auf den Wechsel von "Voll" (true) zu "Geleert" (false)
    if (obj.state.val === false) {
        const gotifyToken = getState(GOTIFY_TOKEN_ID).val;
        const msgScharf = '📪 Der Briefkasten wurde wieder scharfgeschaltet.';
        
        // Bestätigung per Textnachricht
        sendTo('telegram.0', 'send', { text: msgScharf });
        exec(`curl "${GOTIFY_URL}${gotifyToken}" -F "title=Postkasten" -F "message=${msgScharf}" -F "priority=1"`);
        
        console.log('[Postkasten] System manuell zurückgesetzt.');
    }
});