/**
 * GLOBAL: NOTIFY UTILS
 * Zentralisierte Benachrichtigungen für Telegram, Gotify und SayIt (Chromecast).
 * Inklusive Ausschlussliste für reine Video-Streamer.
 */

const GOOGLE_EXCLUDE_LIST = ['chromecast.0.CC-Schlazi', 'chromecast.0.b87bd4deaa73'];
const DEFAULT_RESUME_MS = 8000;

const NOTIFY_CONFIG = {
    gotifyUrl: "https://mygotify.meistermopper.de/message",
    gotifyTokenId: "0_userdata.0.gotifytoken.iobroker",
    telegramInstanz: "telegram.0"
};

/**
 * Hauptfunktion für alle Benachrichtigungen.
 * @param {string} text - Die Nachricht
 * @param {string} title - Titel (für Gotify/Telegram)
 * @param {number} priority - Gotify Priorität (1-5)
 * @param {number} [voiceVol] - Wenn gesetzt, wird die Sprachausgabe mit dieser Lautstärke getriggert.
 */
async function sendGlobalNotify(text, title = "ioBroker", priority = 1, voiceVol = null) {
    // 1. Telegram
    sendTo(NOTIFY_CONFIG.telegramInstanz, "send", { text: `[${title}] ${text}` });

    // 2. Gotify
    const token = getState(NOTIFY_CONFIG.gotifyTokenId).val;
    if (token) {
        const cleanText = text.replace(/<\/?[^>]+(>|$)/g, ""); // HTML-Tags entfernen
        const url = `${NOTIFY_CONFIG.gotifyUrl}?token=${token}`;
        const payload = { title: title, message: cleanText, priority: priority };

        httpPost(url, payload, { timeout: 5000 }, (error) => {
            if (error) console.error(`[GlobalNotify] Gotify Fehler: ${error}`);
        });
    }

    // 3. Sprachausgabe (optional)
    if (voiceVol !== null) {
        await googleWatchdogAnnounce(text, voiceVol);
    }
}

/**
 * Interner Chromecast-Watchdog: Pausiert Musik, spricht, setzt fort.
 * Berücksichtigt die GOOGLE_EXCLUDE_LIST.
 */
async function googleWatchdogAnnounce(text, vol) {
    // Die eigentliche Ansage einmalig auslösen
    sendTo("sayit", "say", { text: text, volume: vol });

    const players = $(`chromecast.0.*.status.playerState`);

    players.each(async function(id) {
        const base = id.split('.status.')[0];

        // Filter: Streamer auf der Blacklist ignorieren (Schlazi/Wozi)
        if (GOOGLE_EXCLUDE_LIST.includes(base)) return;

        const isPlaying = (getState(id).val === 'playing');

        // Musik nach der Wartezeit fortsetzen (Resume)
        if (isPlaying) {
            const oldVol = getState(base + '.player.volume').val;
            const oldUrl = getState(base + '.player.url2play').val;

            if (oldUrl) {
                setStateDelayed(base + '.player.url2play', oldUrl, DEFAULT_RESUME_MS, false);
                setStateDelayed(base + '.player.volume', oldVol, DEFAULT_RESUME_MS + 500, false);
            }
        }
    });
}
