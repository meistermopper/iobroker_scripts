// --- KONFIGURATION ---
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
        powerId: 'sonoff.0.Smartlader.POWER',
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

// --- HILFSFUNKTIONEN ---

/**
 * Zentrale Benachrichtigung
 * Sprachausgabe erfolgt nur, wenn Person anwesend (falls presenceId konfiguriert)
 */
function notify(name, msg, priority = 1, user = '', sayIt = false) {
    const config = geraete[name];
    const timeOk = compareTime('08:00', '20:00', 'between');
    
    // 1. Immer Text-Ausgabe (Telegram & Gotify)
    sendTo('telegram', 'send', { text: msg, user: user });

    const token = getState('0_userdata.0.gotifytoken.iobroker').val;
    exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker" -F "message=${msg}" -F "priority=${priority}"`);

    // 2. Sprach-Ausgabe (SayIt) nur bei Anwesenheit
    let isPresent = true; // Standard: Ja (z.B. für Tablets ohne presenceId)
    if (config && config.presenceId) {
        isPresent = getState(config.presenceId).val;
    }

    if (sayIt && timeOk && isPresent) {
        const cleanMsg = msg
            .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
            .replace(/\n/g, ' ')
            .trim();
            
        sendTo("sayit", "say", { text: cleanMsg, volume: 50 });
    }
    
    console.log(`Meldung für ${name}: ${msg.replace(/\n/g, ' ')} (Sprache: ${sayIt && timeOk && isPresent})`);
}

// --- LOGIK ---

// 1. Spezieller Schedule für Kiki (05:00 Uhr Prüfung)
schedule("0 5 * * *", () => {
    const name = 'Das Smartphone von Kiki';
    const config = geraete[name]; 
    if (config && existsState(config.levelId)) {
        const level = getState(config.levelId).val;
        if (level < 70 && !getState(config.powerId).val) {
            setState(config.powerId, true);
            // Optional: Hier könnte man auch ein notify einbauen
        }
    }
});

// 2. Automatisches Laden für alle Geräte
Object.keys(geraete).forEach(name => {
    const config = geraete[name];

    on({ id: config.levelId, change: 'ne' }, (obj) => {
        const level = obj.state.val;
        const istAn = getState(config.powerId).val;
        
        // Online-Check für die Lade-Logik (wenn offline, dann gar nichts tun)
        if (config.presenceId && !getState(config.presenceId).val) return;

        let targetLaedtId = null;
        if (config.levelId.includes('_level')) {
            targetLaedtId = config.levelId.replace('_level', '_laedt');
        } else if (config.levelId.includes('batteryLevel')) {
            targetLaedtId = config.levelId.replace('batteryLevel', 'isCharging');
        }

        if (targetLaedtId && targetLaedtId !== config.levelId && existsState(targetLaedtId)) {
            const isCharging = level > (obj.oldState ? obj.oldState.val : 0);
            setState(targetLaedtId, isCharging, true); 
        }

        // Einschalt-Logik
        if (level < config.min && !istAn) {
            setState(config.powerId, true);
            if (config.lowBatId) setState(config.lowBatId, true);
            notify(name, ` ${name} 🪫.\nStand: ${level}%`, 1, config.notificationUser, true);
        }

        // Ausschalt-Logik
        else if (level >= config.max && istAn) {
            setState(config.powerId, false);
            if (config.lowBatId) setState(config.lowBatId, false);
            notify(name, `🔋 ${name} ist geladen.\nStand: ${level}%`, 1, config.notificationUser, true);
        }
    });
});

// 3. Manueller Trigger
const manualTriggers = [
    '0_userdata.0.Energie.Smartphone.Thomas_laden',
    '0_userdata.0.Energie.Smartphone.Tablet_laden',
    '0_userdata.0.Energie.Smartphone.Tablet2_laden'
];

on({ id: manualTriggers, val: true }, (obj) => {
    setState('sonoff.0.Smartlader.POWER', true);
    const msg = "Bitte links einstöpseln, ich habe eingeschaltet.";
    
    // Beim manuellen Trigger nehmen wir hier Thomas als Referenz für die Anwesenheit
    const thomasOnline = getState(geraete['Das Smartphone von Thomas'].presenceId).val;
    
    if (compareTime('08:00', '20:00', 'between') && thomasOnline) {
        sendTo("sayit", "say", { text: msg, volume: 50 });
    }
});