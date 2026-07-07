/**
 * Sendet eine globale Benachrichtigung über alle konfigurierten Kanäle (Telegram, Gotify, SayIt).
 * 
 * @param text - Die Nachricht (HTML-Tags sind erlaubt und werden für Gotify automatisch entfernt).
 * @param title - Der Titel der Nachricht (Standard: "ioBroker").
 * @param priority - Die Gotify-Priorität (1 = Info, 5 = Warnung, 8+ = Alarm).
 * @param voiceVol - Wenn gesetzt (0-100), wird zusätzlich eine Sprachausgabe mit dieser Lautstärke getriggert. Bei null erfolgt keine Sprachausgabe.
 */
declare function sendGlobalNotify(
  text: string,
  title?: string,
  priority?: number,
  voiceVol?: number | null
): Promise<void>;
