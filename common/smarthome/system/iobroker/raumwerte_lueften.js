/* eslint-env es2022 */
/**
 * =============================================================================
 * RAUMKLIMA-MASTER v4.0.0 (MONITORING, LÜFTUNG & MORGEN-REPORT)
 * =============================================================================
 * ZWECK: Überwachung der Luftfeuchtigkeit und Temperatur in allen Räumen.
 * PHYSIK: Nutzt den Taupunkt und den absoluten Feuchtegehalt (g/m³), um zu
 * entscheiden, ob Außenluft den Raum wirklich trocknet (Entfeuchtung).
 * FEATURES:

 * - Morgen-Check: Täglicher Bericht über Schimmelgefahr und offene Fenster.
 * - Lüftungsempfehlung: Physikalisch fundierte Entscheidungshilfe.
 * - Benachrichtigung: Intelligente Meldung über Telegram, Gotify und SayIt.
 * =============================================================================
 */
const Dewpoint = require("dewpoint"); // Erfordert das NPM-Modul 'dewpoint'

// --- 1. KONFIGURATION ---
const PFAD = "Raumklima.";
const RAUM_PFAD = "Raum.";
const ID_GOTIFY_TOKEN = "0_userdata.0.gotifytoken.iobroker";

const HUNN = 250; // Höhe über NN
const DEFAULT_TEMP = 18.0; // Auskühlschutz (Min-Temp für Lüften)
const MAX_FEUCHTE = 55.0; // Ziel-Luftfeuchtigkeit
const HYS_TEMP = 0.5; // Puffer Temperatur
const HYS_ENTFEUCHTEN = 0.2; // Puffer Feuchtegehalt (g/m³)

const notificationTimeouts = {};
const doorCheckTimeouts = {};

/**
 * RAUM-KONFIGURATION
 * Definiert Sensoren und deren Typ (heizung/klima) für die korrekte Pfadwahl.
 */
const RAEUME = {
  Aussen: {
    Sensor_TEMP: "alias.0.draussen.thermometer.ACTUAL_TEMPERATURE",
    Sensor_HUM: "alias.0.draussen.thermometer.HUMIDITY",
    aliasName: "draussen",
    type: "heizung",
  },
  Wohnzimmer: {
    Sensor_TEMP: "alias.0.wohnzimmer.heizung.ACTUAL_TEMPERATURE",
    Sensor_HUM: "alias.0.wohnzimmer.heizung.HUMIDITY",
    Aussensensor: "Aussen",
    aliasName: "wohnzimmer",
    type: "heizung",
  },
  Badezimmer_unten: {
    Sensor_TEMP: "alias.0.bad_unten.heizung.ACTUAL_TEMPERATURE",
    Sensor_HUM: "alias.0.bad_unten.heizung.HUMIDITY",
    Aussensensor: "Aussen",
    aliasName: "bad_unten",
    type: "heizung",
  },
  Küche: {
    Sensor_TEMP: "alias.0.kueche.klima.temperature",
    Sensor_HUM: "alias.0.kueche.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "kueche",
    type: "klima",
  },
  Büro: {
    Sensor_TEMP: "alias.0.buero.klima.temperature",
    Sensor_HUM: "alias.0.buero.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "buero",
    type: "klima",
  },
  Konferenz: {
    Sensor_TEMP: "alias.0.konferenz.klima.temperature",
    Sensor_HUM: "alias.0.konferenz.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "konferenz",
    type: "klima",
  },
  Badezimmer_oben: {
    Sensor_TEMP: "alias.0.bad_oben.klima.temperature",
    Sensor_HUM: "alias.0.bad_oben.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "bad_oben",
    type: "klima",
  },
  Gäste_oben: {
    Sensor_TEMP: "alias.0.gast_oben.klima.temperature",
    Sensor_HUM: "alias.0.gast_oben.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "gast_oben",
    type: "klima",
  },
  Gäste_unten: {
    Sensor_TEMP: "alias.0.gast_unten.klima.temperature",
    Sensor_HUM: "alias.0.gast_unten.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "gast_unten",
    type: "klima",
  },
  Fitness: {
    Sensor_TEMP: "alias.0.fitness.klima.temperature",
    Sensor_HUM: "alias.0.fitness.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "fitness",
    type: "klima",
  },
  Schlafzimmer: {
    Sensor_TEMP: "alias.0.schlafzimmer.klima.temperature",
    Sensor_HUM: "alias.0.schlafzimmer.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "schlafzimmer",
    type: "klima",
  },
  Waschküche: {
    Sensor_TEMP: "alias.0.waschen.klima.temperature",
    Sensor_HUM: "alias.0.waschen.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "waschen",
    type: "klima",
  },
  Sauna: {
    Sensor_TEMP: "alias.0.sauna.klima.temperature",
    Sensor_HUM: "alias.0.sauna.klima.humidity",
    Aussensensor: "Aussen",
    aliasName: "sauna",
    type: "klima",
  },
};

// --- 2. HILFSFUNKTIONEN (NOTIFY) ---

function internalNotify(text, priority = 1) {
  // Telegram-Versand
  sendTo("telegram", "send", {
    text: text,
    parse_mode: "HTML",
  });

  // Gotify-Versand
  const token = getState(ID_GOTIFY_TOKEN)?.val;
  if (token) {
    // HTML für Gotify entfernen (Reintext-Formatierung)
    const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "");
    httpPost(
      `https://mygotify.meistermopper.de/message?token=${token}`,
      {
        title: "Haus-Klima",
        message: cleanText,
        priority: priority,
      },
      (error) => {
        if (error) console.error(`[Raumwerte Lüften] Gotify Fehler: ${error}`);
      },
    );
  }
}

// --- 3. MORGEN-REPORT (TÄGLICH 08:00) ---

function runMorningReport() {
  const kritischKlima = [];
  const offeneFenster = [];

  for (const raum in RAEUME) {
    if (raum === "Aussen") continue;
    const conf = RAEUME[raum];

    // Feuchtigkeit prüfen
    const hSuffix = conf.type === "heizung" ? "heizung.HUMIDITY" : "klima.humidity";
    const humID = `alias.0.${conf.aliasName}.${hSuffix}`;

    if (existsState(humID)) {
      const hum = getState(humID)?.val;
      if (hum > 60) kritischKlima.push(`${raum} (${Math.round(hum)}%)`);
    }

    // Offene Fenster prüfen
    const fID = `alias.0.${conf.aliasName}.fenster.STATE`;
    if (existsState(fID) && getState(fID)?.val > 0) {
      offeneFenster.push(raum === "Wohnzimmer" ? "Terrassentür" : raum);
    }
  }

  if (kritischKlima.length > 0) {
    internalNotify(
      `⚠️ <b>Morgen-Check: Schimmelgefahr!</b>\nHohe Feuchtigkeit in: ${kritischKlima.join(", ")}`,
      3,
    );
  }
  if (offeneFenster.length > 0) {
    internalNotify(
      `🪟 <b>Morgen-Check: Fenster noch offen!</b>\nBitte schließen in: ${offeneFenster.join(", ")}`,
      3,
    );
  }
}

// --- 4. BERECHNUNG & LOGIK ---

const xdp = new Dewpoint(HUNN);
const runden = (wert, stellen) => Math.round(wert * 10 ** stellen) / 10 ** stellen;

function calc(raum) {
  const config = RAEUME[raum];
  if (!config?.Sensor_TEMP) return;

  const t = getState(config.Sensor_TEMP)?.val;
  const rh = getState(config.Sensor_HUM)?.val;
  const y = xdp.Calc(t, rh);

  setState(`${PFAD}${RAUM_PFAD}${raum}.Feuchtegehalt_Absolut`, runden(y.x, 2), true);
  setState(`${PFAD}${RAUM_PFAD}${raum}.Temperatur`, runden(t, 1), true);

  if (config.Aussensensor) {
    const ta = getState(`${PFAD}${RAUM_PFAD}${config.Aussensensor}.Temperatur`)?.val;
    const xa = getState(`${PFAD}${RAUM_PFAD}${config.Aussensensor}.Feuchtegehalt_Absolut`)?.val;
    if (xa === 0) return;

    // Lüftungsempfehlung: Physikalischer Vergleich (Innen vs Außen)
    const lueften =
      xa <= y.x - (HYS_ENTFEUCHTEN + 0.1) &&
      ta <= t - 0.6 &&
      t >= DEFAULT_TEMP + HYS_TEMP &&
      rh >= MAX_FEUCHTE;

    setState(`${PFAD}${RAUM_PFAD}${raum}.Lüftungsempfehlung`, lueften, true);
    setTimeout(() => checkNotification(raum), 2000);
  }
}

function checkNotification(raum) {
  const conf = RAEUME[raum];
  if (!conf?.aliasName) return;
  const fID = `alias.0.${conf.aliasName}.fenster.STATE`;
  const aDP = `0_userdata.0.Heizen.Lueften.${raum}_Ansage`;
  if (!existsState(fID)) return;

  const empf = getState(`${PFAD}${RAUM_PFAD}${raum}.Lüftungsempfehlung`)?.val;
  const offen = getState(fID)?.val > 0;
  const gemeldet = existsState(aDP) ? getState(aDP)?.val : false;

  if (empf && !offen && !gemeldet) {
    notify(aDP, `Im ${raum} sollte gelüftet werden.`);
  } else if (!empf && offen && !gemeldet) {
    if (!doorCheckTimeouts[raum]) {
      doorCheckTimeouts[raum] = setTimeout(() => {
        if (
          getState(fID)?.val > 0 &&
          !getState(`${PFAD}${RAUM_PFAD}${raum}.Lüftungsempfehlung`)?.val
        ) {
          let txt = `Im ${raum} sollte das Fenster geschlossen werden.`;
          if (raum === "Wohnzimmer")
            txt = "Im Wohnzimmer sollte die Terrassentür geschlossen werden.";
          notify(aDP, txt);
        }
        doorCheckTimeouts[raum] = null;
      }, 60000);
    }
  }
}

/**
 * Sendet die Benachrichtigung basierend auf der Tageszeit
 * Tag (08-20h): Prio 3 | Nacht: Prio 1
 */
function notify(dp, msg) {
  const isDay = compareTime("08:00", "20:00", "between");
  const prio = isDay ? 3 : 1;

  internalNotify(msg, prio);

  if (existsState(dp)) setState(dp, true, true);
  if (isDay) {
    // Alle SayIt-Instanzen dynamisch finden und benachrichtigen
    $(`system.adapter.sayit.*.alive`).each((id) => {
      const instance = id.split(".").slice(2, 4).join(".");
      sendTo(instance, "say", { text: msg.replace(/_/g, " ") });
    });
  }
  notificationTimeouts[dp] = setTimeout(() => {
    if (existsState(dp)) setState(dp, false, true);
  }, 3600000);
}

// --- 5. INITIALISIERUNG & TRIGGER ---

schedule("0 8 * * *", () => {
  runMorningReport();
});

// Automatische Datenpunkterstellung und Trigger-Registrierung
for (const r in RAEUME) {
  createState(`${PFAD}${RAUM_PFAD}${r}.Lüftungsempfehlung`, false, {
    type: "boolean",
  });
  createState(`${PFAD}${RAUM_PFAD}${r}.Feuchtegehalt_Absolut`, 0, {
    type: "number",
  });
  createState(`${PFAD}${RAUM_PFAD}${r}.Temperatur`, 0, { type: "number" });

  if (RAEUME[r].aliasName) {
    createState(`0_userdata.0.Heizen.Lueften.${r}_Ansage`, false, {
      type: "boolean",
    });
    on({ id: RAEUME[r].Sensor_TEMP, change: "ne" }, () => calc(r));
    on({ id: RAEUME[r].Sensor_HUM, change: "ne" }, () => calc(r));
  }
}
