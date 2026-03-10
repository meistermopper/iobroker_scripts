// --- KONFIGURATION (Aliase) ---
const ID_TRIGGER_ABENDLICHT = "0_userdata.0.Licht.Wohnzimmer.Abendlicht";

const ALIASE = {
  FERNSEHLICHT: "alias.0.wohnzimmer.licht.fernsehlicht.POWER",
  HUE_EI: "alias.0.wohnzimmer.licht.ei.command",
  HUE_KOMMODE: "alias.0.wohnzimmer.licht.kommode.command",
  GALAXIE: "alias.0.wohnzimmer.licht.Galaxie.POWER",
  VENTILATOR: "alias.0.wohnzimmer.klima.ventilator.1", // "1" laut deinem Screenshot
  MARANTZ: "alias.0.wohnzimmer.media.marantz.power",
};

const GOTIFY_TOKEN_ID = "0_userdata.0.gotifytoken.iobroker";

// --- LOGIK ---

schedule("30 23 * * *", async () => {
  //console.log("[GoodNight] Starte automatische Abschaltung...");

  // 1. Einfache Schalter (An/Aus)
  const schalter = [
    ALIASE.FERNSEHLICHT,
    ALIASE.GALAXIE,
    ALIASE.VENTILATOR,
    ALIASE.MARANTZ,
  ];

  schalter.forEach((id) => {
    if (existsState(id) && getState(id).val) {
      setState(id, false);
    }
  });

  // 2. Abendlicht ausschalten -> Triggert den sanften Sonnenuntergang
  // Da deine Hue-Lampen (Ei/Kommode) am Abendlicht-Skript hängen,
  // dimmen sie jetzt automatisch über 2 Sek (oder deine eingestellte Zeit) aus.
  setState(ID_TRIGGER_ABENDLICHT, false);

  // 3. Benachrichtigung
  const msg = "+++ 💡 Licht, Galaxie, Ventilator und Marantz ausgeschaltet +++";
  sendTo("telegram", "send", { text: msg });

  // Gotify Notification
  const tokenState = getState(GOTIFY_TOKEN_ID);
  if (tokenState) {
    const curlCmd = `curl "https://mygotify.meistermopper.de/message?token=${tokenState.val}" -F "title=ioBroker" -F "message=${msg}" -F "priority=1"`;
    exec(curlCmd);
  }
});
