/**
 * =============================================================================
 * SKRIPT: SMART-CHARGING ZENTRALE (V2.7 - FINAL & CLEAN)
 * =============================================================================
 * ZWECK: 
 * Dieses Skript überwacht Deine Geräte und steuert die Ladung so, dass der
 * Akku geschont wird (30% bis 80%). Es verhindert doppelte Meldungen und
 * reagiert auf Sprachbefehle zum Laden.
 * * FEATURES:
 * 1. REBOOT-FEST: Speichert Zustände in '0_userdata.0', damit nach einem 
 * Neustart nicht alles vergessen wird.
 * 2. SELF-HEALING: Erstellt fehlende Datenpunkte automatisch beim Start.
 * 3. SPRACH-TRIGGER: Spezielle Ansage für Thomas und das Tablet.
 * =============================================================================
 */

// --- 1. KONFIGURATION DER GERÄTE ---
// Wir bündeln alle Infos in einem zentralen Objekt namens 'geraete'.
const geraete = {
    'Das Smartphone von Kiki': {
        levelId: '0_userdata.0.Energie.Smartphone.Kiki_level',           // Woher kommt der Akkustand?
        powerId: 'alias.0.wohnzimmer.energie.ladestation_kiki.Ladestation_Kiki.POWER',                      // Eigene Dose für Kiki
        presenceId: 'unifi-network.0.clients.users.78:53:64:01:8b:04.isOnline', // Nur melden, wenn Kiki da ist
        notifiedFullId: '0_userdata.0.Energie.Smartphone.Kiki_MeldungVoll', // Speicher für "Schon gemeldet"
        lowBatId: '0_userdata.0.Energie.Smartphone.Kiki_lowBat',        // Rotes Icon in der VIS
        min: 30, max: 80, notificationUser: ''                          // Grenzwerte (30% an, 80% aus)
    },
    'Das Smartphone von Thomas': {
        levelId: '0_userdata.0.Energie.Smartphone.Thomas_level',
        powerId: 'alias.0.wohnzimmer.energie.smartlader.on',            // Nutzt den zentralen Alias
        presenceId: 'unifi-network.0.clients.users.dc:e5:5b:11:b8:7e.isOnline',
        notifiedFullId: '0_userdata.0.Energie.Smartphone.ThomasMeldungVoll', // Laut Grafik ohne Unterstrich
        lowBatId: '0_userdata.0.Energie.Smartphone.Thomas_lowBat',
        min: 30, max: 80, notificationUser: 'Thomas'
    },
    'Das Tablet': {
        levelId: '0_userdata.0.Energie.Smartphone.Tablet_level',
        powerId: 'alias.0.wohnzimmer.energie.smartlader.on',            // Teilt sich die Dose mit Thomas
        notifiedFullId: '0_userdata.0.Energie.Smartphone.Tablet_MeldungVoll',
        lowBatId: '0_userdata.0.Energie.Smartphone.Tablet_lowBat',
        min: 30, max: 80, notificationUser: ''
    }
};

// --- 2. INITIALISIERUNG (DATENPUNKTE ERSTELLEN) ---
// Diese Funktion prüft beim Skriptstart, ob alle Datenpunkte existieren.
async function initStates() {
    for (const name of Object.keys(geraete)) {
        const config = geraete[name];

        // A. Der Sperr-Datenpunkt (verhindert doppelte Nachrichten)
        if (config.notifiedFullId && !existsState(config.notifiedFullId)) {
            await createStateAsync(config.notifiedFullId, false, { name: 'Sperre Voll-Meldung', type: 'boolean', role: 'state', def: false });
        }
        // B. Der LowBat-Datenpunkt (für die VIS Anzeige)
        if (config.lowBatId && !existsState(config.lowBatId)) {
            await createStateAsync(config.lowBatId, false, { name: 'LowBat Anzeige', type: 'boolean', role: 'state', def: false });
        }
        // C. Der "Lädt"-Datenpunkt (zeigt an, ob der Akku gerade steigt)
        let laedtId = config.levelId.replace('_level', '_laedt');
        if (!existsState(laedtId)) {
            await createStateAsync(laedtId, false, { name: 'Ladestatus Aktiv', type: 'boolean', role: 'state', def: false });
        }
    }
}
initStates(); // Führt die Prüfung sofort beim Start aus

// --- 3. BENACHRICHTIGUNGS-HELFER ---
function notify(name, msg, priority = 1, user = '', sayIt = false) {
    const config = geraete[name];
    const timeOk = compareTime('08:00', '20:00', 'between'); // Keine Ansagen mitten in der Nacht
    const token = getState('0_userdata.0.gotifytoken.iobroker').val;

    // Telegram & Gotify Nachrichten senden
    sendTo('telegram', 'send', { text: msg, user: user });
    exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=Akku" -F "message=${msg}" -F "priority=${priority}"`);

    // Sprachausgabe nur, wenn gewünscht, die Zeit passt und die Person im WLAN ist
    let isPresent = (config && config.presenceId) ? getState(config.presenceId).val : true;
    if (sayIt && timeOk && isPresent) {
        const cleanMsg = msg.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF])/g, '').replace(/\n/g, ' ');
        sendTo("sayit", "say", { text: cleanMsg, volume: 50 });
    }
}

// --- 4. HAUPT-ÜBERWACHUNG ---
Object.keys(geraete).forEach(name => {
    const config = geraete[name];

    // Wir "abonnieren" den Akkustand (levelId)
    on({ id: config.levelId, change: 'ne' }, (obj) => {
        const level = obj.state.val; // Neuer Prozentwert
        const istAn = getState(config.powerId).val; // Ist der Strom an?
        const alreadyNotified = getState(config.notifiedFullId).val; // Wurde heute schon gemeldet?

        // 1. VIS LADESTATUS AKTUALISIEREN
        let targetLaedtId = config.levelId.replace('_level', '_laedt');
        if (existsState(targetLaedtId)) {
            // Wenn neuer Wert > alter Wert, dann lädt das Gerät
            setState(targetLaedtId, level > (obj.oldState ? obj.oldState.val : 0), true);
        }

        // 2. SPERRE ZURÜCKSETZEN
        // Wenn die Dose aus ist oder der Akku wieder leer wird, erlauben wir eine neue Meldung.
        if (!istAn || level < config.min) {
            if (alreadyNotified) setState(config.notifiedFullId, false, true);
        }

        // 3. EINSCHALT-LOGIK (Akku < 30%)
        if (level < config.min && !istAn) {
            setState(config.powerId, true);
            if (config.lowBatId) setState(config.lowBatId, true);
            notify(name, "🪫 " + name + " sollte geladen werden.\nStand: " + level + "%", 1, config.notificationUser, true);
        }

        // 4. AUSSCHALT-LOGIK (Akku >= 80%)
        // Nur wenn Dose noch an ist UND wir für diesen Ladevorgang noch nicht gemeldet haben.
        else if (level >= config.max && istAn && !alreadyNotified) {
            setState(config.notifiedFullId, true, true); // Sperre im Datenpunkt setzen
            setState(config.powerId, false);             // Dose ausschalten
            if (config.lowBatId) setState(config.lowBatId, false);
            notify(name, "🔋 " + name + " ist geladen.\nStand: " + level + "%", 1, config.notificationUser, true);
        }
    });
});

// --- 5. MANUELLER START (SPRACHBEFEHL) ---
// Reagiert auf die Datenpunkte Thomas_laden und Tablet_laden
const manualTriggers = [
    '0_userdata.0.Energie.Smartphone.Thomas_laden',
    '0_userdata.0.Energie.Smartphone.Tablet_laden'
];

on({ id: manualTriggers, val: true }, (obj) => {
    // A. Ladegerät einschalten
    setState('alias.0.wohnzimmer.energie.smartlader.on', true);
    
    // B. Die gewünschte Ansage ausgeben
    const ansage = "Bitte links einstöpseln, ich habe eingeschaltet.";
    if (compareTime('08:00', '20:00', 'between')) {
        sendTo("sayit", "say", { text: ansage, volume: 50 });
    }
    
    // C. Den Button in der VIS nach 2 Sekunden wieder auf 'false' setzen
    setTimeout(() => { 
        setState(obj.id, false, true); 
    }, 2000);
});

// --- 6. KIKI MORGEN-CHECK (05:00 Uhr) ---
schedule("0 5 * * *", () => {
    const kiki = geraete['Das Smartphone von Kiki'];
    const level = getState(kiki.levelId).val;
    // Falls das Handy morgens unter 70% ist, vorsichtshalber laden
    if (level < 70 && !getState(kiki.powerId).val) {
        setState(kiki.powerId, true);
    }
});