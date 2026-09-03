/* eslint-env es2022 */
/**
 * Name:   Telegram Menü Steuerung
 * Zweck:  Interaktives Telegram-Menü zur Abfrage von Klimawerten, Fensterstatus,
 *         Kia-Standort, Terminen, Astrozeiten und Schalten von Geräten.
 */

// --- KONFIGURATION ---

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

/**
 * Sends a smart notification via Telegram and optionally Gotify.
 *
 * @param {string} user - Target username for Telegram.
 * @param {string} text - Message text (HTML formatted).
 * @param {number} priority - Notification priority for Gotify (default: 1).
 * @param {string|number|null} chatId - Optional direct chat ID for Telegram.
 */
function smartNotify(user, text, priority = 1, chatId = null) {
  const options = { text: text, parse_mode: "HTML" };
  if (chatId) {
    options.chatId = chatId;
  } else if (user) {
    options.user = user;
  }
  sendTo("telegram.0", "send", options);

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

/**
 * Displays an inline keyboard menu in Telegram.
 *
 * @param {string} user - Target username for Telegram.
 * @param {string} text - Menu title / message.
 * @param {Array} buttons - Inline keyboard button layout matrix.
 * @param {string|number|null} chatId - Optional direct chat ID for Telegram.
 */
function showMenu(user, text, buttons, chatId = null) {
  const options = {
    text: text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  };
  if (chatId) {
    options.chatId = chatId;
  } else if (user) {
    options.user = user;
  }
  sendTo("telegram.0", "send", options);
}

// --- AKTIONEN ---

/**
 * Collects and sends the current temperature and humidity report for all defined rooms.
 *
 * @param {string} user - Requesting username.
 * @param {string|number|null} chatId - Requesting chat ID.
 */
function getKlimaStatus(user, chatId = null) {
  let msg = "<b>🌡️ Haus-Klima Report:</b>\n\n";
  let hasCritical = false;

  for (const raum in RAEUME) {
    const conf = RAEUME[raum];
    const tS = conf.type === "heizung" ? "heizung.ACTUAL_TEMPERATURE" : "klima.temperature";
    const hS = conf.type === "heizung" ? "heizung.HUMIDITY" : "klima.humidity";

    const tempId = `alias.0.${conf.aliasName}.${tS}`;
    const humId = `alias.0.${conf.aliasName}.${hS}`;

    if (!existsState(tempId)) continue;

    const t = getState(tempId)?.val;
    const h = existsState(humId) ? getState(humId)?.val : null;

    const tempFormatted = typeof t === "number" ? t.toFixed(1) : "--";
    const humFormatted = typeof h === "number" ? Math.round(h) : "--";

    if (typeof h === "number" && h > 60) {
      hasCritical = true;
      msg += `⚠️ ${raum}: <b>${tempFormatted}°C / ${humFormatted}%</b> 💧\n`;
    } else {
      msg += `🏠 ${raum}: ${tempFormatted}°C / ${humFormatted}%\n`;
    }
  }

  const isDay = compareTime("08:00", "20:00", "between");
  const prio = hasCritical && isDay ? 5 : 1;
  smartNotify(user, msg, prio, chatId);
}

/**
 * Checks all window contact sensors and sends an open/closed summary.
 *
 * @param {string} user - Requesting username.
 * @param {string|number|null} chatId - Requesting chat ID.
 */
function getFensterStatus(user, chatId = null) {
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
  smartNotify(user, msg, prio, chatId);
}

/**
 * Triggers a live GPS position update from the vehicle and retrieves geocoded address.
 *
 * @param {string} user - Requesting username.
 * @param {string|number|null} chatId - Requesting chat ID.
 */
function getKia(user, chatId = null) {
  smartNotify(
    user,
    "📡 <b>Aktueller Standort wird vom Fahrzeug abgefragt...</b>\nBitte einen kurzen Moment Geduld (ca. 30–60 Sek.).",
    1,
    chatId,
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

    if (typeof lat !== "number" || typeof lon !== "number") {
      smartNotify(
        user,
        "⚠️ <b>Kia Standort:</b> Keine gültigen GPS-Koordinaten vorhanden.",
        1,
        chatId,
      );
      return;
    }

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
            1,
            chatId,
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

/**
 * Displays the main menu.
 *
 * @param {string} user - Requesting username.
 * @param {string|number|null} chatId - Requesting chat ID.
 */
function menuMain(user, chatId = null) {
  showMenu(
    user,
    "<b>🏠 ioBroker Zentrale</b>\nBitte wählen:",
    [
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
    ],
    chatId,
  );
}

/**
 * Displays the switch / device control submenu.
 *
 * @param {string} user - Requesting username.
 * @param {string|number|null} chatId - Requesting chat ID.
 */
function menuSchalter(user, chatId = null) {
  showMenu(
    user,
    "<b>💡 Schaltungen</b>\nWas soll geschaltet werden?",
    [
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
    ],
    chatId,
  );
}

// --- LOGIK ---

on({ id: "telegram.0.communicate.request", change: "any" }, async (obj) => {
  const val = obj?.state?.val;
  if (typeof val !== "string" || !val.trim()) return;

  let user = "";
  let cmd = val.trim();

  // Extract username if request is formatted as "[User] command"
  if (cmd.startsWith("[")) {
    const bracketIndex = cmd.indexOf("]");
    if (bracketIndex !== -1) {
      user = cmd.substring(1, bracketIndex).trim();
      cmd = cmd.substring(bracketIndex + 1).trim();
    }
  }

  // Ignore empty command payload (e.g. after adapter reset or empty bracket payload)
  if (!cmd) return;

  const chatId = existsState("telegram.0.communicate.requestChatId")
    ? getState("telegram.0.communicate.requestChatId")?.val
    : null;

  console.log(
    `[Telegram Menü] Request empfangen von "${user || "unbekannt"}" (ChatID: ${chatId || "n/a"}): "${cmd}"`,
  );

  // Normalize command: lowercase, strip leading slash, bot handle suffix (@bot) and parameters
  cmd = cmd.toLowerCase();
  if (cmd.startsWith("/")) {
    cmd = cmd.substring(1);
  }
  if (cmd.includes("@")) {
    cmd = cmd.split("@")[0];
  }
  if (cmd.includes(" ")) {
    cmd = cmd.split(" ")[0];
  }

  switch (cmd) {
    case "m":
    case "main":
    case "menu":
    case "menü":
    case "menue":
    case "menu_main":
    case "start":
      menuMain(user, chatId);
      break;
    case "menu_klima":
    case "menu_heiz":
      getKlimaStatus(user, chatId);
      break;
    case "fenster":
      getFensterStatus(user, chatId);
      break;
    case "menu_sw":
      menuSchalter(user, chatId);
      break;
    case "kia_pos":
      getKia(user, chatId);
      break;
    case "termine": {
      const tState = getState("ical.1.data.table");
      if (!tState?.val) {
        smartNotify(user, "Keine Termine.", 1, chatId);
      } else {
        const heute = new Date().setHours(0, 0, 0, 0);
        let tMsg = "";
        tState.val.forEach((t) => {
          const diff = Math.floor((new Date(t._date).setHours(0, 0, 0, 0) - heute) / 86400000);
          if (diff >= 0 && diff <= 2)
            tMsg += `📅 <b>${diff === 0 ? "Heute: " : diff === 1 ? "Morgen: " : ""}</b> ${t.event}\n`;
        });
        smartNotify(user, tMsg === "" ? "Keine Termine." : `<b>Termine:</b>\n${tMsg}`, 1, chatId);
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
      smartNotify(user, `☀️ <b>Astro</b>\n🌅 Aufgang: ${sr}\n🌇 Untergang: ${ss}`, 1, chatId);
      break;
    }
    case "sp_on":
      setState("sonoff.0.Terrassendose.POWER2", true);
      smartNotify(user, "✅ Drehspieß <b>AN</b>", 1, chatId);
      break;
    case "sp_off":
      setState("sonoff.0.Terrassendose.POWER2", false);
      smartNotify(user, "⚪ Drehspieß <b>AUS</b>", 1, chatId);
      break;
    case "tr_on":
      setState("sonoff.0.Terrassendose.POWER", true);
      smartNotify(user, "✅ Terrasse <b>AN</b>", 1, chatId);
      break;
    case "tr_off":
      setState("sonoff.0.Terrassendose.POWER", false);
      smartNotify(user, "⚪ Terrasse <b>AUS</b>", 1, chatId);
      break;
    case "st_on":
      setState("sonoff.0.Terrassendose.POWER1", true);
      smartNotify(user, "✅ Steckleiste <b>AN</b>", 1, chatId);
      break;
    case "st_off":
      setState("sonoff.0.Terrassendose.POWER1", false);
      smartNotify(user, "⚪ Steckleiste <b>AUS</b>", 1, chatId);
      break;
    default:
      console.log(`[Telegram Menü] Unbekannter Befehl${user ? ` von ${user}` : ""}: "${cmd}"`);
      break;
  }
});
