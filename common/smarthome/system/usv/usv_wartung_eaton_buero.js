/**
 * =============================================================================
 * SKRIPT: USV WARTUNG & KONDITIONIERUNG (BÜRO) - VERSION 38.1
 * =============================================================================
 * ZWECK: 
 * Akkupflege der USV durch kontrollierte Entladung.
 * * UPGRADES IN DIESER VERSION:
 * 1. VOLL-BROADCAST: Nutzt jetzt die SayIt-Instanzen 0, 2, 3, 4 und 5 laut Screenshot.
 * 2. MULTI-DEVICE LOGIK: Schleifen-Steuerung für alle Lautsprecher.
 * 3. SPRECH-BREMSE (5%): Schützt das WLAN vor Überlastung durch 5 Audio-Streams.
 * 4. SAFETY-STOP: Schaltet beim Skript-Stopp sofort den Strom wieder ein.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const dpPrefix = 'javascript.0.USV_Wartung1';               
const upsNutPrefix = 'nut.1';                               
const sonoffPower = 'alias.0.buero.usv.POWER';              
const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker').val;

/**
 * LISTE DEINER SPRACH-AUSGABEN (BASIEREND AUF DEINEM SCREENSHOT)
 * Hier sind nun alle Instanzen eingetragen, die in deinem ioBroker sichtbar sind.
 */
const sayitInstances = ['sayit.0', 'sayit.2', 'sayit.3', 'sayit.4', 'sayit.5']; 

// Speichert den letzten Wert der Ansage (verhindert Dauer-Gequassel)
let lastSpokenSoc = -1; 
let isLocked = false;

// --- 2. INITIALISIERUNG ---
/**
 * Legt alle VIS-Datenpunkte an, falls diese noch nicht existieren.
 */
async function initDP() {
    const states = [
        ['Minimum_Rest_Prozent', 35],       
        ['Minimum_Rest_Minuten', 10],       
        ['Jetzt_Warten', false],            
        ['Speak_Minuten', true],            
        ['Speak_bei_Wartung', true],        
        ['Alexa_Lautstaerke', 30],          
        ['Wartung_eingeleitet', false],     
        ['Restlaufzeit_in_Minuten', 0]      
    ];

    for (let s of states) {
        if (!existsState(`${dpPrefix}.${s[0]}`)) {
            await createStateAsync(`${dpPrefix}.${s[0]}`, { 
                name: s[0], 
                def: s[1], 
                type: typeof s[1] === 'number' ? 'number' : 'boolean' 
            });
        }
    }
    console.log("[USV-Wartung] Startbereit. Alarm-Verteilung an: " + sayitInstances.join(', '));
}

// --- 3. KOMMUNIKATION ---

/**
 * Sendet Text-Nachrichten an Telegram und Gotify.
 */
function notify(text, priority = 5) {
    const header = '🔌🔋 USV Büro\n\n';
    sendTo('telegram', 'send', { text: header + text });
    console.log(`USV-Log: ${text}`);
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=USV Wartung" -F "message=${text}" -F "priority=${priority}"`);
}

/**
 * DIE BROADCAST-FUNKTION:
 * Diese Funktion nimmt den Warntext und verteilt ihn an alle Google-Geräte.
 */
function speak(text) {
    // Sicherheitsprüfung: Ist die Sprachausgabe in der VIS überhaupt eingeschaltet?
    if (!getState(`${dpPrefix}.Speak_bei_Wartung`).val) return;
    
    const vol = getState(`${dpPrefix}.Alexa_Lautstaerke`).val;
    
    // SCHLEIFE: Wir gehen die Liste der sayitInstances nacheinander durch
    sayitInstances.forEach((instance) => {
        /**
         * Wir senden den Befehl an die jeweilige Instanz (0, 2, 3, 4, 5).
         * Das Format `${vol}; ${text}` setzt zuerst die Lautstärke und dann den Text.
         */
        sendTo(instance, "say", { text: `${vol}; ${text}`, volume: vol });
    });
    
    console.log(`[USV-Audio] Broadcast an ${sayitInstances.length} Geräte gesendet.`);
}

// --- 4. WARTUNGS-LOGIK ---

/**
 * Startet die Wartung und trennt die USV vom Stromnetz.
 */
async function startWartung(isManual = false) {
    setState(`${dpPrefix}.Wartung_eingeleitet`, true);
    lastSpokenSoc = -1; // Reset, damit die erste Ansage sofort triggert
    setState(sonoffPower, false); // Steckdose AUS
    notify(isManual ? 'Manuelle Wartung gestartet.' : 'Automatische Wartung gestartet.');
}

/**
 * Beendet die Wartung und stellt die Stromzufuhr wieder her.
 */
async function stopWartung(reason = '') {
    setState(sonoffPower, true); // Steckdose AN
    setTimeout(() => {
        setState(`${dpPrefix}.Wartung_eingeleitet`, false);
        setState(`${dpPrefix}.Jetzt_Warten`, false);
    }, 15000);
    const soc = getState(`${upsNutPrefix}.battery.charge`).val;
    notify(`Wartung beendet (${reason}). Stand: ${soc}%.`);
}

// --- 5. EVENT-TRIGGER ---

/**
 * REAKTION AUF AKKUSTAND:
 * Hier greift die "Sprech-Bremse", damit das Haus nicht im Sekundentakt lärmt.
 */
on({ id: `${upsNutPrefix}.battery.charge`, change: 'ne' }, async (obj) => {
    const soc = obj.state.val;
    const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`).val;
    const onBattery = getState(`${upsNutPrefix}.status.onbattery`).val === true;
    const minSoc = getState(`${dpPrefix}.Minimum_Rest_Prozent`).val;

    // A: Automatischer Stopp bei Erreichen des Entlade-Limits
    if (isWartung && soc <= minSoc) {
        await stopWartung(`Limit ${minSoc}% erreicht`);
        return;
    }
    
    // B: SPRACHSTEUERUNG (Nur bei Batteriebetrieb)
    if (onBattery) {
        /** * DIE SPRECH-BREMSE:
         * Wir lassen die Google-Geräte nur sprechen, wenn:
         * - Es der erste Wert ist (lastSpokenSoc === -1)
         * - ODER der Wert glatt durch 5 teilbar ist (Modulo 5)
         * - ODER wir kurz vor dem Abschalt-Limit stehen (+2%)
         */
        if (lastSpokenSoc === -1 || (soc % 5 === 0 && soc !== lastSpokenSoc) || soc === (minSoc + 2)) {
            
            lastSpokenSoc = soc; // Aktuellen Stand merken
            const runtime = Math.floor(getState(`${dpPrefix}.Restlaufzeit_in_Minuten`).val);
            const speakMin = getState(`${dpPrefix}.Speak_Minuten`).val;
            
            // Textbaustein generieren
            let text = isWartung ? 'Wartung im Büro läuft. ' : 'Warnung. Stromausfall im Büro. ';
            text += speakMin ? `Restlaufzeit ${runtime} Minuten.` : `Akkustand ${soc} Prozent.`;
            
            // RUFE DEN BROADCAST AUF
            speak(text);
        }
    }
});

/**
 * Erkennt den Wechsel des Betriebsmodus (Netz / Batterie).
 */
on({ id: `${upsNutPrefix}.status.onbattery`, change: 'ne' }, async (obj) => {
    const isWartance = getState(`${dpPrefix}.Wartung_eingeleitet`).val;
    if (obj.state.val === true && !isWartance) {
        notify('⚠️ WARNUNG: Stromversorgung unterbrochen!', 8);
    } else if (obj.state.val === false) {
        lastSpokenSoc = -1; // Reset für den nächsten Durchlauf
        if (!isWartance) notify('✅ Netzspannung wiederhergestellt.');
    }
});

// Sekunden in Minuten für die VIS umrechnen
on({ id: `${upsNutPrefix}.battery.runtime`, change: 'ne' }, (obj) => {
    setState(`${dpPrefix}.Restlaufzeit_in_Minuten`, Math.floor(obj.state.val / 60), true);
});

// VIS Button-Trigger
on({ id: `${dpPrefix}.Jetzt_Warten`, change: 'ne', val: true }, () => {
    startWartung(true);
});

// --- 6. SAFETY-EXIT (SKRIPT-SCHUTZ) ---

/**
 * Diese Funktion ist dein "Airbag": Wenn du das Skript stoppst, 
 * wird die Steckdose sofort wieder auf AN gesetzt.
 */
onStop(function (callback) {
    console.warn("[USV-Safety] Skript-Stopp! Erzwinge Netzbetrieb zur Sicherheit...");
    setState(sonoffPower, true);
    // Wir geben dem Befehl 500ms Zeit, bevor das Skript endgültig stirbt.
    setTimeout(callback, 500); 
});

// --- PROGRAMMSTART ---
initDP();
