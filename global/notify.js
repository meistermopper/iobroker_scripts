/* eslint-env es2022 */
/**
 * =============================================================================
 * GLOBAL: NOTIFY UTILS
 * =============================================================================
 * ZWECK: Zentralisierte Benachrichtigungen für Telegram, Gotify und SayIt.
 *
 * STEUERUNG DER KANÄLE:
 * 1. Telegram: Wird standardmäßig bei jedem Aufruf gesendet.
 * 2. Gotify:   Wird gesendet, wenn der Token-Datenpunkt einen Wert enthält.
 * 3. Sprachausgabe (SayIt): Wird NUR aktiv, wenn 'voiceVol' ungleich 'null' ist.
 *    Wird der Parameter weggelassen oder explizit 'null' übergeben, erfolgt
 *    keine Ansage über die Google-Speaker.
 *
 * PARAMETER-LOGIK:
 * - priority:  Setzt die Gotify-Dringlichkeit (1 = Info, 5 = Warnung, 8+ = Kritischer Alarm).
 * - voiceVol:  Gibt die Lautstärke (0-100) an. Steuert gleichzeitig, OB eine
 *              Sprachausgabe stattfindet.
 *
 * ANWENDUNGSBEISPIELE:
 * - sendGlobalNotify("Waschmaschine ist fertig");
 *   -> Standard: Schickt Text via Telegram & Gotify (Prio 1). Keine Sprachausgabe.
 * - sendGlobalNotify("Einbruchversuch!", "ALARM", 5);
 *   -> Alarm: Telegram & Gotify mit höchster Priorität (5). Keine Sprachausgabe.
 * - sendGlobalNotify("Es hat geklingelt", "Haustür", 2, 50);
 *   -> Info mit Ansage: Telegram, Gotify (Prio 2) und 50% Lautstärke über Google Home.
 * - sendGlobalNotify("Update verfügbar", "System", 1, null);
 *   -> Explizit stumm: Nur Messenger, 'null' verhindert die Sprachausgabe garantiert.
 * =============================================================================
 */

const GOOGLE_EXCLUDE_LIST = ["chromecast.0.CC-Schlazi", "chromecast.0.b87bd4deaa73"];
const DEFAULT_RESUME_MS = 8000;

const NOTIFY_CONFIG = {
  gotifyUrl: "https://mygotify.meistermopper.de/message",
  gotifyTokenId: "0_userdata.0.gotifytoken.iobroker",
  telegramInstanz: "telegram.0",
};

/**
 * Hauptfunktion für alle Benachrichtigungen.
 * @param {string} text - Die Nachricht
 * @param {string} title - Titel (für Gotify/Telegram)
 * @param {number} priority - Gotify Priorität (1-5)
 * @param {number} [voiceVol] - Wenn gesetzt, wird die Sprachausgabe mit dieser Lautstärke getriggert.
 * @param {string|null} [voiceText] - Optionaler alternativer Text für die Sprachausgabe.
 */
// biome-ignore lint/correctness/noUnusedVariables: Global function used in other scripts
async function sendGlobalNotify(
  text,
  title = "ioBroker",
  priority = 1,
  voiceVol = null,
  voiceText = null,
) {
  // 1. Telegram
  sendTo(NOTIFY_CONFIG.telegramInstanz, "send", {
    text: `[${title}] ${text}`,
    parse_mode: "HTML",
  });

  // 2. Gotify
  const token = getState(NOTIFY_CONFIG.gotifyTokenId)?.val;
  if (token) {
    const cleanText = text.replace(/<\/?[^>]+(>|$)/g, ""); // HTML-Tags entfernen
    const url = `${NOTIFY_CONFIG.gotifyUrl}?token=${token}`;
    const payload = { title: title, message: cleanText, priority: priority };

    httpPost(url, payload, { timeout: 15000 }, (error) => {
      if (error) console.error(`[GlobalNotify] Gotify Fehler: ${error}`);
    });
  }

  // 3. Sprachausgabe (optional)
  if (voiceVol !== null) {
    const rawVoiceText = voiceText ?? text;
    // Emojis, Symbole und HTML-Tags für die Sprachausgabe entfernen
    const cleanedVoiceText = rawVoiceText
      .replace(/<\/?[^>]+(>|$)/g, "") // Strip HTML tags (e.g. <pre>) for TTS
      .replace(/\p{Extended_Pictographic}/gu, "") // Entfernt Emojis/Symbole
      .replace(/\s\s+/g, " ") // Bereinigt doppelte Leerzeichen
      .trim();
    await googleWatchdogAnnounce(cleanedVoiceText, voiceVol);
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

  players.each((/** @type {any} */ id) => {
    const stateId = String(id);
    const base = stateId.split(".status.")[0];

    // Filter: Streamer auf der Blacklist ignorieren (Schlazi/Wozi)
    if (GOOGLE_EXCLUDE_LIST.includes(base)) return;

    const isPlaying = getState(stateId)?.val === "playing";

    // Musik nach der Wartezeit fortsetzen (Resume)
    if (isPlaying) {
      const oldVol = getState(`${base}.player.volume`)?.val;
      const oldUrl = getState(`${base}.player.url2play`)?.val;

      if (oldUrl) {
        setStateDelayed(`${base}.player.url2play`, oldUrl, DEFAULT_RESUME_MS, false);
        setStateDelayed(`${base}.player.volume`, oldVol, DEFAULT_RESUME_MS + 500, false);
      }
    }
  });
}
