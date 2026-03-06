// --- KONFIGURATION ---
const ID_ENIGMA_STANDBY  = 'enigma2.0.enigma2.STANDBY';
const ID_ENIGMA_RECORD   = 'enigma2.0.enigma2.isRecording';
const ID_ENIGMA_REBOOT   = 'enigma2.0.main_command.REBOOT';
const ID_ENIGMA_GOTO_STB = 'enigma2.0.main_command.STANDBY';

const ID_HARMONY_CHROME  = 'harmony.0.Harmony_Wozi.activities.Chromecast_Video';

// Direkte Pfade ohne Alias
const ID_TV_POWER_ON     = 'samsung_tizen.0.powerOn';
const ID_TV_OFF_CMD      = 'samsung_tizen.0.control.KEY_POWEROFF';

const GOTIFY_TOKEN_ID    = '0_userdata.0.gotifytoken.iobroker';

let timeout_enigma;

// --- SCHEDULE: Täglich um 03:02 Uhr ---
schedule("2 3 * * *", async () => {
    
    // 1. ENIGMA REBOOT (nur wenn im Standby und keine Aufnahme läuft)
    const isEnigmaStandby = getState(ID_ENIGMA_STANDBY).val;
    const isEnigmaRecording = getState(ID_ENIGMA_RECORD).val;

    if (isEnigmaStandby && !isEnigmaRecording) {
        //console.log("[Nightly] Enigma2 ist im Standby und nimmt nicht auf. Starte Reboot...");
        setState(ID_ENIGMA_REBOOT, true);

        const msg = '+++📡 Der Sat-Receiver wurde neu gestartet und geht nach dem Booten wieder in Standby.+++';
        
        // Benachrichtigungen
        sendTo('telegram', 'send', { text: msg });
        
        const token = getState(GOTIFY_TOKEN_ID).val;
        if (token) {
            const curlCmd = `curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker Wartung" -F "message=${msg}" -F "priority=1"`;
            exec(curlCmd);
        }

        // Nach 3 Minuten (Bootzeit) zurück in den Schlaf schicken
        if (timeout_enigma) clearTimeout(timeout_enigma);
        timeout_enigma = setTimeout(() => {
            setState(ID_ENIGMA_GOTO_STB, true);
            //console.log("[Nightly] Enigma2 Befehl 'Standby' nach Reboot gesendet.");
        }, 180000); 
    }

    // 2. HARMONY & TV CLEANUP
    // Falls eine Aktivität nachts noch auf "an" steht
    if (getState(ID_HARMONY_CHROME).val > 0) {
        //console.log("[Nightly] Räume hängende Harmony Aktivität auf...");
        setState(ID_HARMONY_CHROME, 0); 

        // TV ausschalten, falls er noch an ist
        if (getState(ID_TV_POWER_ON).val) {
            setState(ID_TV_OFF_CMD, true);
        }
    }
});