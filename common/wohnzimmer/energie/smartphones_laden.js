/**
 * =============================================================================
 * SKRIPT: SMART-CHARGING ZENTRALE (V2.0)
 * =============================================================================
 * ZWECK: 
 * Intelligente Ladesteuerung für Smartphones und Tablets. Schont den Akku durch 
 * Einhaltung von Min/Max-Grenzwerten (Konditionierung).
 * * FEATURES:
 * 1. ZENTRALE KONFIGURATION: Alle Geräte und Grenzwerte an einem Ort.
 * 2. REPEAT-SCHUTZ: Meldungen über vollen Akku erfolgen nur einmalig beim Abschalten.
 * 3. ANWESENHEITS-CHECK: Sprachausgabe nur, wenn die Person im WLAN ist.
 * 4. EMOJI-FILTER: Entfernt Symbole aus Sprachnachrichten für sauberes SayIt.
 * =============================================================================
 */

// --- 1. KONFIGURATION DER GERÄTE ---

const geraete = {
    'Das Smartphone von Kiki': {
        levelId: '0_userdata.0.Energie.Smartphone.Kiki_level',
        powerId: 'sonoff.0.Ladestation_Kiki.POWER',
        presenceId: 'unifi-network.0.clients.users.78:53:64:01:8b:04.isOnline',
        min: 30, max: 80, notificationUser: ''
    },
    'Das Smartphone von Thomas': {
        levelId: '0_userdata.0.Energie.Smartphone.Thomas_level',
        powerId: 'sonoff.0.Smartlader.POWER',
        presenceId: 'unifi-network.0.clients.users.dc:e5:5b:11:b8:7e.isOnline',
        lowBatId: '0_userdata.0.Energie.Smartphone.Thomas_lowBat',
        min: 30, max: 80, notificationUser: 'Thomas'
    },
    'Das Tablet': {
        levelId: '0_userdata.0.Energie.Smartphone.Tablet_level',
        powerId: 'sonoff.0.Smartlader.POWER', // Mehrfachnutzung eines Aktors
        lowBatId: '0_userdata.0.Energie.Smartphone.Tablet_lowBat',
        min: 30, max: 80, notificationUser: ''
    },
    'Das Tablet2': {
        levelId: 'fullybrowser.0.192_168_178_235.Info.batteryLevel',
        powerId: 'sonoff.0.Smartlader.POWER',
        lowBatId: '0_userdata.0.Energie.Smartphone.Tablet2_lowBat',
        min: 30, max: 80, notificationUser: ''
    }
};

// --- 2. HILFSFUNKTIONEN ---

/**
 * Zentrale Funktion für Benachrichtigungen (Text & Sprache).
 * @param {string} name - Name des Geräts für das Log.
 * @param {string} msg - Die Nachricht.
 * @param {number} priority - Gotify Priorität.
 * @param {string} user - Ziel-User für Telegram.
 * @param {boolean} sayIt - Soll Sprachausgabe erfolgen?
 */
function notify(name, msg, priority = 1, user = '', sayIt = false) {
    const config = geraete[name];
    const timeOk = compareTime('08:00', '20:00', 'between');
    const token = getState('0_userdata.0.gotifytoken.iobroker').val;

    // A. TEXT-MELDUNG (Telegram & Gotify)
    sendTo('telegram', 'send', { text: msg, user: user });
    exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=Smartphone Akku" -F "message=${msg}" -F "priority=${priority}"`);

    // B. SPRACH-MELDUNG (Nur bei Anwesenheit und Zeitfenster)
    let isPresent = true; 
    if (config && config.presenceId) {
        isPresent = getState(config.presenceId).val;
    }

    if (sayIt && timeOk && isPresent) {
        // Bereinigung des Textes für SayIt (Emojis und Zeilenumbrüche entfernen)
        const cleanMsg = msg
            .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
            .replace(/\n/g, ' ')
            .trim();
            
        sendTo("sayit", "say", { text: cleanMsg, volume: 50 });
    }
    
    console.log(`[Battery-Watchdog] Meldung für ${name}: ${msg.replace(/\n/g, ' ')}`);
}

// --- 3. LOGIK-STEUERUNG ---

/**
 * SONDERFALL: Kiki's 05:00 Uhr Check.
 * Stellt sicher, dass das Handy morgens genug Saft hat, falls es nachts nicht geladen wurde.
 */
schedule("0 5 * * *", () => {
    const name = 'Das Smartphone von Kiki';
    const config = geraete[name]; 
    if (config && existsState(config.levelId)) {
        const level = getState(config.levelId).val;
        // Wenn unter 70% und Lader ist aus -> einschalten
        if (level < 70 && !getState(config.powerId).val) {
            setState(config.powerId, true);
            console.log(`[Battery-Watchdog] Morgen-Check Kiki: Ladung bei ${level}% gestartet.`);
        }
    }
});

/**
 * HAUPT-LOGIK: Überwachung aller konfigurierten Geräte.
 * Wir loopen durch das 'geraete' Objekt und legen Trigger an.
 */
Object.keys(geraete).forEach(name => {
    const config = geraete[name];

    on({ id: config.levelId, change: 'ne' }, (obj) => {
        const level = obj.state.val;
        const istAn = getState(config.powerId).val;
        
        // ONLINE-CHECK: Wenn Gerät nicht im WLAN (presenceId vorhanden), keine Logik ausführen
        if (config.presenceId && !getState(config.presenceId).val) return;

        // HELPER: Bestimmung des Ladestatus-Datenpunkts (VIS Anzeige)
        let targetLaedtId = null;
        if (config.levelId.includes('_level')) {
            targetLaedtId = config.levelId.replace('_level', '_laedt');
        } else if (config.levelId.includes('batteryLevel')) {
            targetLaedtId = config.levelId.replace('batteryLevel', 'isCharging');
        }

        // Setzt den Ladestatus in 0_userdata (wird geladen? true/false)
        if (targetLaedtId && targetLaedtId !== config.levelId && existsState(targetLaedtId)) {
            const isCharging = level > (obj.oldState ? obj.oldState.val : 0);
            setState(targetLaedtId, isCharging, true); 
        }

        /**
         * EINSCHALT-LOGIK:
         * Wenn Akku unter Minimum und Lader ist aus.
         */
        if (level < config.min && !istAn) {
            setState(config.powerId, true);
            if (config.lowBatId) setState(config.lowBatId, true); // LowBat-Flag für VIS setzen
            notify(name, `🪫 ${name} sollte geladen werden.\nAkkustand: ${level}%`, 1, config.notificationUser, true);
        }

        /**
         * AUSSCHALT-LOGIK:
         * Wenn Akku das Maximum erreicht hat und der Lader noch AN ist.
         * WICHTIG: Die Meldung erfolgt NUR HIER (beim Abschalten).
         * Wenn das Handy bei 100% entlädt (Pixel Konditionierung), triggert dieser Block nicht mehr,
         * da 'istAn' bereits false ist.
         */
        else if (level >= config.max && istAn) {
            setState(config.powerId, false);
            if (config.lowBatId) setState(config.lowBatId, false);
            notify(name, `🔋 ${name} ist geladen.\nAkkustand: ${level}%`, 1, config.notificationUser, true);
        }
    });
});

/**
 * MANUELLER TRIGGER:
 * Ermöglicht das Einschalten des Laders über VIS-Buttons, auch wenn Akku noch voll ist.
 */
const manualTriggers = [
    '0_userdata.0.Energie.Smartphone.Thomas_laden',
    '0_userdata.0.Energie.Smartphone.Tablet_laden',
    '0_userdata.0.Energie.Smartphone.Tablet2_laden'
];

on({ id: manualTriggers, val: true }, (obj) => {
    setState('sonoff.0.Smartlader.POWER', true);
    const msg = "Ladestation eingeschaltet. Bitte einstöpseln.";
    
    // Wir nutzen Thomas' Anwesenheit als Bedingung für die Ansage
    const thomasConfig = geraete['Das Smartphone von Thomas'];
    const thomasOnline = thomasConfig && thomasConfig.presenceId ? getState(thomasConfig.presenceId).val : true;
    
    if (compareTime('08:00', '20:00', 'between') && thomasOnline) {
        sendTo("sayit", "say", { text: msg, volume: 50 });
    }
    
    // Button in der VIS nach 2 Sek wieder auf false setzen
    setTimeout(() => { setState(obj.id, false, true); }, 2000);
});