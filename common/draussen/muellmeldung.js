/**
 * =============================================================================
 * MÜLL-ERINNERUNG v2.0
 * =============================================================================
 * ZWECK: Sendet am Vorabend eine Benachrichtigung, wenn Müll abgeholt wird.
 * VERBESSERUNGEN:
 * - Konstanten für alle IDs zur besseren Wartbarkeit.
 * - Gekapselte notify-Funktion für sauberen Code.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
    daysLeft: 'trashschedule.0.next.daysLeft',
    trashTypes: 'trashschedule.0.next.typesText',
    gotifyToken: '0_userdata.0.gotifytoken.iobroker',
    gotifyUrl: 'https://mygotify.meistermopper.de/message'
};

// --- 2. HILFSFUNKTIONEN ---

/**
 * Sendet eine Benachrichtigung an Telegram und Gotify.
 * @param {string} message - Die zu sendende Nachricht.
 */
function notify(message) {
    // 1. An Telegram senden
    sendTo('telegram.0', 'send', { text: `🚮 ${message}` });

    // 2. An Gotify senden
    const token = getState(CONFIG.gotifyToken).val;
    if (token) {
        exec(`curl "${CONFIG.gotifyUrl}?token=${token}" -F "title=ioBroker: Müll" -F "message=🚮 ${message}" -F "priority=5"`);
    }
}

// --- 3. HAUPTLOGIK ---

// Trigger: Jeden Sonntag bis Freitag um 18:00 Uhr
schedule("0 18 * * 0-5", async () => {
    const daysLeft = getState(CONFIG.daysLeft).val;
    
    if (daysLeft === 1) {
        const muellSorte = getState(CONFIG.trashTypes).val;
        const muellText = `Morgen wird ${muellSorte} abgeholt.`;

        // Benachrichtigungen (Text & Sprache) senden
        notify(muellText);

        // Sprachausgabe mit Fallback
        if (typeof googleWatchdogAnnounce === 'function') {
            await googleWatchdogAnnounce(muellText, 40);
        } else {
            sendTo("sayit", "say", { text: muellText, volume: 40 });
        }
    }
});