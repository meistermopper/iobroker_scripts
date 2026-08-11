/* eslint-env es2022 */
// =============================================================================
// MASTER-STEUERUNG v3.6 (CLEAN SWITCH-STRUCTURE & PRIO-FIX)
// =============================================================================

const ID_GOTIFY_TOKEN = "0_userdata.0.gotifytoken.iobroker";
const ID_GOOGLE_KEY = "0_userdata.0.google.mapsAPItoken";
const VIN = getState("0_userdata.0.Energie.Kia_e_niro.vin")?.val;

const ID_KIA_LOC = {
  lat: `bluelink.0.${VIN}.vehicleLocation.lat`,
  lon: `bluelink.0.${VIN}.vehicleLocation.lon`,
  url: `bluelink.0.${VIN}.vehicleLocation.position_url`,
  update: "0_userdata.0.Energie.Kia_e_niro.Aktualisierung",
  save: "0_userdata.0.Energie.Kia_e_niro.Standort",
  forceLocation: `bluelink.0.${VIN}.control.force_refresh_from_car`,
};

const RAEUME = {
  Wohnzimmer: { aliasName: "wohnzimmer", type: "heizung" },
  Badezimmer_unten: { aliasName: "bad_unten", type: "heizung" },
  Küche: { aliasName: "kueche", type: "klima" },
  Büro: { aliasName: "buero", type: "klima" },
  Konferenz: { aliasName: "konferenz", type: "klima" },
  Badezimmer_oben: { aliasName: "bad_oben", type: "klima" },
  Gäste_oben: { aliasName: "gast_oben", type: "klima" },
  Gäste_unten: { aliasName: "gast_unten", type: "klima" },
  Fitness: { aliasName: "fitness", type: "klima" },
  Schlafzimmer: { aliasName: "schlafzimmer", type: "klima" },
  Waschküche: { aliasName: "waschen", type: "klima" },
  Sauna: { aliasName: "sauna", type: "klima" },
};

// --- HILFSFUNKTIONEN ---

function smartNotify(user, text, priority = 1) {
  sendTo("telegram.0", { user: user, text: text, parse_mode: "HTML" });
  const token = getState(ID_GOTIFY_TOKEN)?.val;
  if (token) {
    const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "");
    httpPost(
      `https://mygotify.meistermopper.de/message?token=${token}`,
      {
        title: "ioBroker",
        message: cleanText,
        priority: priority,
      },
      (error) => {
        if (error) console.error(`[Telegram Menü] Gotify Fehler: ${error}`);
      },
    );
  }
}

function showMenu(user, text, buttons) {
  sendTo("telegram.0", {
    user: user,
    text: text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
}

// --- AKTIONEN ---

function getKlimaStatus(user) {
  let msg = "<b>🌡️ Haus-Klima Report:</b>\n\n";
  let hasCritical = false;

  for (const raum in RAEUME) {
    const conf = RAEUME[raum];
    const tS = conf.type === "heizung" ? "heizung.ACTUAL_TEMPERATURE" : "klima.temperature";
    const hS = conf.type === "heizung" ? "heizung.HUMIDITY" : "klima.humidity";

    if (!existsState(`alias.0.${conf.aliasName}.${tS}`)) continue;

    const t = getState(`alias.0.${conf.aliasName}.${tS}`)?.val;
    const h = getState(`alias.0.${conf.aliasName}.${hS}`)?.val;

    if (h > 60) {
      hasCritical = true;
      msg += `⚠️ ${raum}: <b>${t.toFixed(1)}°C / ${Math.round(h)}%</b> 💧\n`;
    } else {
      msg += `🏠 ${raum}: ${t.toFixed(1)}°C / ${Math.round(h)}%\n`;
    }
  }

  const isDay = compareTime("08:00", "20:00", "between");
  const prio = hasCritical && isDay ? 5 : 1;
  smartNotify(user, msg, prio);
}

function getFensterStatus(user) {
  const offene = [];
  for (const raum in RAEUME) {
    const fID = `alias.0.${RAEUME[raum].aliasName}.fenster.STATE`;
    if (existsState(fID) && getState(fID)?.val > 0) {
      offene.push(raum === "Wohnzimmer" ? "Terrassentür" : raum);
    }
  }
  const isDay = compareTime("08:00", "20:00", "between");
  const prio = offene.length > 0 && isDay ? 5 : 1;
  const msg =
    offene.length === 0
      ? "✅ <b>Alle Fenster/Türen sind zu.</b>"
      : `⚠️ <b>Offen:</b>\n\n- ${offene.join("\n- ")}`;
  smartNotify(user, msg, prio);
}

function getKia(user) {
  smartNotify(
    user,
    "📡 <b>Aktueller Standort wird vom Fahrzeug abgefragt...</b>\nBitte einen kurzen Moment Geduld (ca. 30–60 Sek.).",
  );

  let hasResponded = false;
  let timer = null;
  let listenerToken = null;

  const fetchAndSendLocation = (isLive = true) => {
    if (hasResponded) return;
    hasResponded = true;

    if (timer) clearTimeout(timer);
    if (listenerToken) unsubscribe(listenerToken);

    const lat = getState(ID_KIA_LOC.lat)?.val;
    const lon = getState(ID_KIA_LOC.lon)?.val;
    const key = getState(ID_GOOGLE_KEY)?.val;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${key}`;

    httpGet(url, (err, res) => {
      if (!err && res.statusCode === 200) {
        try {
          const data = JSON.parse(res.data);
          const addr = data.results?.[0]?.formatted_address || "Unbekannte Adresse";
          setState(ID_KIA_LOC.save, addr, true);
          const title = isLive
            ? "📍 <b>Kia Standort (aktuell):</b>"
            : "📍 <b>Kia Standort (letzter bekannter Stand):</b>\n<i>(Fahrzeug antwortet nicht)</i>";
          smartNotify(
            user,
            `${title}\n${addr}\n\n<a href="${getState(ID_KIA_LOC.url)?.val}">Auf Karte zeigen</a>`,
          );
        } catch (e) {
          console.error(`[Telegram Menü] Fehler beim Verarbeiten der Standort-Daten: ${e}`);
        }
      } else {
        console.error(`[Telegram Menü] Google Geocoding Fehler: ${err || res?.statusCode}`);
      }
    });
  };

  // Set up event listener for position state updates
  listenerToken = on({ id: ID_KIA_LOC.lat, change: "any" }, () => {
    fetchAndSendLocation(true);
  });

  // Timeout fallback after 60 seconds
  timer = setTimeout(() => {
    if (!hasResponded) {
      console.warn(
        "[Telegram Menü] Kia Standort-Abfrage Timeout - verwende vorhandene ioBroker-Daten.",
      );
      fetchAndSendLocation(false);
    }
  }, 60000);

  // Trigger vehicle location update button
  if (existsState(ID_KIA_LOC.forceLocation)) {
    setState(ID_KIA_LOC.forceLocation, true);
  } else {
    fetchAndSendLocation(false);
  }
}

function menuMain(user) {
  showMenu(user, "<b>🏠 ioBroker Zentrale</b>\nBitte wählen:", [
    [{ text: "🚗 Standort Kia", callback_data: "kia_pos" }],
    [
      { text: "🌡️ Klima-Check", callback_data: "menu_klima" },
      { text: "💡 Schaltungen", callback_data: "menu_sw" },
    ],
    [
      { text: "📅 Termine", callback_data: "termine" },
      { text: "🪟 Fenster", callback_data: "fenster" },
    ],
    [{ text: "☀️ Astro", callback_data: "astro" }],
  ]);
}

function menuSchalter(user) {
  showMenu(user, "<b>💡 Schaltungen</b>\nWas soll geschaltet werden?", [
    [
      { text: "🍖 Drehspieß AN", callback_data: "sp_on" },
      { text: "⚪ OFF", callback_data: "sp_off" },
    ],
    [
      { text: "🌳 Terrasse AN", callback_data: "tr_on" },
      { text: "⚪ OFF", callback_data: "tr_off" },
    ],
    [
      { text: "🔌 Steckleiste AN", callback_data: "st_on" },
      { text: "⚪ OFF", callback_data: "st_off" },
    ],
    [{ text: "⬅️ Hauptmenü", callback_data: "main" }],
  ]);
}

// --- TRIGGER ---

on({ id: "telegram.0.communicate.request", change: "any" }, async (obj) => {
  const val = obj.state.val;
  const user = val.substring(1, val.indexOf("]"));
  const cmd = val
    .substring(val.indexOf("]") + 1)
    .trim()
    .toLowerCase();

  switch (cmd) {
    case "m":
    case "main":
    case "menu_main":
      menuMain(user);
      break;
    case "menu_klima":
    case "menu_heiz":
      getKlimaStatus(user);
      break;
    case "fenster":
      getFensterStatus(user);
      break;
    case "menu_sw":
      menuSchalter(user);
      break;
    case "kia_pos":
      getKia(user);
      break;
    case "termine": {
      const tState = getState("ical.1.data.table");
      if (!tState?.val) {
        smartNotify(user, "Keine Termine.");
      } else {
        const heute = new Date().setHours(0, 0, 0, 0);
        let tMsg = "";
        tState.val.forEach((t) => {
          const diff = Math.floor((new Date(t._date).setHours(0, 0, 0, 0) - heute) / 86400000);
          if (diff >= 0 && diff <= 2)
            tMsg += `📅 <b>${diff === 0 ? "Heute: " : diff === 1 ? "Morgen: " : ""}</b> ${t.event}\n`;
        });
        smartNotify(user, tMsg === "" ? "Keine Termine." : `<b>Termine:</b>\n${tMsg}`);
      }
      break;
    }
    case "astro": {
      const sr = getAstroDate("sunrise", undefined, 0).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const ss = getAstroDate("sunset", undefined, 0).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      smartNotify(user, `☀️ <b>Astro</b>\n🌅 Aufgang: ${sr}\n🌇 Untergang: ${ss}`);
      break;
    }
    case "sp_on":
      setState("sonoff.0.Terrassendose.POWER2", true);
      smartNotify(user, "✅ Drehspieß <b>AN</b>");
      break;
    case "sp_off":
      setState("sonoff.0.Terrassendose.POWER2", false);
      smartNotify(user, "⚪ Drehspieß <b>AUS</b>");
      break;
    case "tr_on":
      setState("sonoff.0.Terrassendose.POWER", true);
      smartNotify(user, "✅ Terrasse <b>AN</b>");
      break;
    case "tr_off":
      setState("sonoff.0.Terrassendose.POWER", false);
      smartNotify(user, "⚪ Terrasse <b>AUS</b>");
      break;
    case "st_on":
      setState("sonoff.0.Terrassendose.POWER1", true);
      smartNotify(user, "✅ Steckleiste <b>AN</b>");
      break;
    case "st_off":
      setState("sonoff.0.Terrassendose.POWER1", false);
      smartNotify(user, "⚪ Steckleiste <b>AUS</b>");
      break;
  }
});
