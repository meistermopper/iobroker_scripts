/* eslint-env es2022 */
/**
 * Name:   Konferenz-Beleuchtung & Vitrinen-Lichtshow
 * Zweck:  Steuerung der Stehlampe und Vitrinen-Lichtshow im Konferenzraum basierend auf Helligkeit, Tagungsauswahl und Astro-Events.
 */

// --- KONFIGURATION ---
const ID_LUX = "alias.0.draussen.licht.CURRENT_ILLUMINATION";
const ID_TAGUNG_AKTIV = "0_userdata.0.Heizen.Programme.Tagung";
const ID_LAMPE = "alias.0.konferenz.licht.stehlampe.POWER";

// Vitrine / Lichtshow
const ID_VITRINE_TRIGGER = "0_userdata.0.vitrine.Lichtshow";
const ID_VITRINE_LICHT = "alias.0.konferenz.licht.vitrine.state";
const ID_VITRINE_EFFECT = "alias.0.konferenz.licht.vitrine.effect";
const ID_VITRINE_HEX_COLOR = "zigbee.0.00158d000819fa91.hex_color";
const ID_VITRINE_AVAILABLE = "zigbee.0.00158d000819fa91.available";

// Benachrichtigungen
const ID_GOTIFY_TOKEN = "0_userdata.0.gotifytoken.iobroker";

// --- LOGIK ---

/**
 * Sendet Benachrichtigungen über Telegram, Gotify und SayIt (Sprachansage),
 * wenn die Vitrine beim Einschalten offline ist.
 */
function sendOfflineNotification() {
  const warnText =
    "Achtung: Die Vitrinen-Beleuchtung im Konferenzraum ist offline und kann nicht eingeschaltet werden.";

  // 1. Log-Meldung
  console.warn(`[Lichtshow] ${warnText}`);

  // 2. Telegram-Benachrichtigung
  sendTo("telegram", "send", {
    text: "⚠️ <b>Achtung Vitrine:</b> Die Vitrinen-Beleuchtung im Konferenzraum ist offline (available = false) und kann nicht eingeschaltet werden.",
    parse_mode: "HTML",
  });

  // 3. Gotify-Benachrichtigung via native httpPost()
  const gotifyToken = getState(ID_GOTIFY_TOKEN)?.val;
  if (gotifyToken) {
    httpPost(
      `https://mygotify.meistermopper.de/message?token=${gotifyToken}`,
      {
        title: "Vitrine Offline",
        message: warnText,
        priority: 5,
      },
      (err) => {
        if (err) {
          console.error(`[Lichtshow] Gotify Fehler: ${err}`);
        }
      },
    );
  }

  // 4. Sprachansage (SayIt)
  sendTo("sayit", "say", {
    text: "Achtung, die Vitrinen-Beleuchtung im Konferenzraum ist offline.",
    volume: 50,
  });
}

/**
 * Kern-Logik: Die Lichtshow-Funktion
 */
function setLichtshow(pwr) {
  // Timer löschen, um Überschneidungen zu vermeiden
  clearStateDelayed(ID_VITRINE_LICHT);
  clearStateDelayed(ID_VITRINE_EFFECT);
  clearStateDelayed(ID_VITRINE_HEX_COLOR);

  if (pwr) {
    // Erreichbarkeit des Zigbee-Geräts vor dem Senden prüfen
    if (existsObject(ID_VITRINE_AVAILABLE) && getState(ID_VITRINE_AVAILABLE)?.val === false) {
      sendOfflineNotification();
      return;
    }

    // 1. Licht einschalten
    setState(ID_VITRINE_LICHT, true);
    // 2. Farbmodus erzwingen (beendet den colortemp/Weißlicht-Modus)
    setStateDelayed(ID_VITRINE_HEX_COLOR, "#FF0000", 500);
    // 3. Colorloop-Effekt starten
    setStateDelayed(ID_VITRINE_EFFECT, "colorloop", 1000);
  } else {
    setState(ID_VITRINE_EFFECT, "none"); // 'none' oder 'stop_colorloop'
    setStateDelayed(ID_VITRINE_LICHT, false, 700);
  }
}

/**
 * Hilfsfunktion zum Schalten der kompletten Konferenz-Beleuchtung
 */
function schalteKonfiBeleuchtung(pwr) {
  setState(ID_LAMPE, pwr, true);
  // Hier rufen wir jetzt die neue Lichtshow-Funktion auf!
  setState(ID_VITRINE_TRIGGER, pwr);
}

// --- TRIGGER ---

// 1. Manueller Trigger für die Vitrine (oder durch andere Skriptteile)
// @ts-expect-error
on({ id: ID_VITRINE_TRIGGER, change: "ne" }, (obj) => {
  setLichtshow(obj.state.val);
});

// 2. Helligkeitssensor (mit Hysterese)
// @ts-expect-error
on({ id: ID_LUX, change: "ne" }, (obj) => {
  const lux = obj.state.val;
  const luxAlt = obj.oldState.val;
  if (getState(ID_TAGUNG_AKTIV)?.val) {
    if (lux < 1000 && luxAlt >= 1000) schalteKonfiBeleuchtung(true);
    else if (lux > 1500 && luxAlt <= 1500) schalteKonfiBeleuchtung(false);
  }
});

// 3. Sonnenuntergang
schedule({ astro: "sunset", shift: -30 }, () => {
  if (getState(ID_TAGUNG_AKTIV)?.val) schalteKonfiBeleuchtung(true);
});

// 4. Nachtabschaltung (23:30 Uhr)
schedule("30 23 * * *", () => {
  // Wir schalten hier alles aus
  schalteKonfiBeleuchtung(false);
});

// INITIALISIERUNG: Zustand beim Start einmal prüfen
setLichtshow(getState(ID_VITRINE_TRIGGER)?.val);
