/* eslint-env es2022 */
// Hilfsfunktion für Benachrichtigungen (spart massiv Platz)
function notifyThomas(msg) {
  const token = getState("0_userdata.0.gotifytoken.iobroker")?.val;
  sendTo("telegram", "send", { text: msg, user: "Thomas" });
  console.log(`Thomas: ${msg}`);
  if (token) {
    httpPost(
      `https://mygotify.meistermopper.de/message?token=${token}`,
      {
        title: "ioBroker: 🎄",
        message: msg,
        priority: 1,
      },
      (error) => {
        if (error) console.error(`[Weihnachtsbaum Terrasse] Gotify Fehler: ${error}`);
      },
    );
  }
}

// 1. Einschalten zur Goldenen Stunde + 30 Min
schedule({ astro: "goldenHour", shift: 30 }, async () => {
  // Schalte nur, wenn das Gerät online ist
  if (getState("sonoff.0.Weihnachtsbaum.alive")?.val === true) {
    setState("sonoff.0.Terrassendose.POWER1", true);
    notifyThomas("+++ 🎄 Terrasse: Goldene Stunde (+30 Min.), Weihnachtsbaum eingeschaltet +++");
  }
});

// 2. Nachtruhe (Ausschalten um 23:00 Uhr)
schedule("0 23 * * *", async () => {
  setState("sonoff.0.Terrassendose.POWER1", false);
  // Hier reicht ein Log oder eine kurze Info
  console.log("Weihnachtsbaum Terrasse: Nachtruhe.");
});

// 3. Morgens an (60 Min vor Sonnenaufgang)
schedule({ astro: "sunrise", shift: -60 }, async () => {
  if (getState("sonoff.0.Weihnachtsbaum.alive")?.val === true) {
    setState("sonoff.0.Terrassendose.POWER1", true);
    notifyThomas("+++ 🎄 Terrasse: 60 Min vor Sonnenaufgang, Weihnachtsbaum eingeschaltet +++");
  }
});

// 4. Tagsüber aus (09:00 Uhr)
schedule("0 9 * * *", async () => {
  setState("sonoff.0.Terrassendose.POWER1", false);
  notifyThomas("+++ 🎄 Terrasse: Weihnachtsbaum wurde ausgeschaltet +++");
});
