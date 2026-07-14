/* eslint-env es2022 */
/**
 * Name:   Tägliche Astro-Info
 * Zweck:  Sendet Sonnenzeiten an Telegram und Gotify
 */

schedule("0 4 * * *", async () => {
  // 1. Astro-Daten abrufen und direkt formatieren (HH:mm)
  const sunrise = formatDate(getAstroDate("sunrise"), "hh:mm");
  const golden = formatDate(getAstroDate("goldenHour"), "hh:mm");
  const sunset = formatDate(getAstroDate("sunset"), "hh:mm");

  // 2. Nachricht für Telegram (mit HTML)
  const msgHTML = [
    "<pre>+++ ☀️ Astro-Info +++",
    `Sonnenaufgang:  ${sunrise}`,
    `Goldene Stunde: ${golden}`,
    `Sonnenuntergang: ${sunset}`,
    "++++++++++++++++++</pre>",
  ].join("\n");

  // 3. Nachricht für Gotify (Plaintext)
  const msgPlain = `☀️ Sonnenaufgang: ${sunrise}\n☀️ Goldene Stunde: ${golden}\n☀️ Sonnenuntergang: ${sunset}`;

  // 4. Versand an Telegram
  sendTo("telegram", "send", {
    text: msgHTML,
    parse_mode: "HTML",
  });

  // 5. Versand an Gotify via httpPost
  const token = getState("0_userdata.0.gotifytoken.iobroker")?.val;
  if (token) {
    httpPost(
      `https://mygotify.meistermopper.de/message?token=${token}`,
      {
        title: "ioBroker: Astro",
        message: msgPlain,
        priority: 1,
      },
      (error) => {
        if (error) console.error(`[Astrozeiten] Gotify Fehler: ${error}`);
      },
    );
  }

  //console.log(`Astro-Info: Daten für heute gesendet (${sunrise} / ${sunset})`);
});
