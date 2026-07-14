/* eslint-env es2022 */
/**
 * SKRIPT: Akku-Zustands-Tabelle (V35 - Modern UI Edition)
 * * ZWECK:
 * Erstellt eine hocheffiziente 4-Spalten-Tabelle für das Tablet.
 * * FEATURES:
 * - Blau leuchtende Header-Balken (perfekte Lesbarkeit im Dark Mode).
 * - "Smart-Crawl" Logik für Batteriewerte (verhindert 0% Fehler).
 * - Namens-Deduplizierung & Ruhezeit-Meldungen.
 * - Vollständig für dich kommentiert.
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
  thresholds: {
    crit: 25,
    warn: 40,
    bigBattCrit: 3.3,
    bigBattWarn: 3.6,
  },
  // Moderne Status-Icons (schärfer als Emojis auf manchen Tablets)
  symbols: { ok: "●", warn: "▲", crit: "✖" },

  design: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "11px",
    // Der blaue Verlauf für die Überschriften (macht sie lesbar!)
    colorHeader: "linear-gradient(180deg, #265686, #1a3a5c)",
    colorBgEven: "#121212",
    colorBgOdd: "#000000",
    colorText: "#ECECEC",
    colorOk: "#4caf50",
    colorWarn: "#FFD740",
    colorCrit: "#FF5252",
  },

  dpVIS: "0_userdata.0.Tabellen.akku",
  dpAlarmCount: "0_userdata.0.Tabellen.akkuAlarm",
  idGotifyToken: "0_userdata.0.gotifytoken.iobroker",
  useTelegram: true,
  useGotify: true,
};

// Definition der zu durchsuchenden Geräte
const ADAPTER_CONFIG = [
  { name: "HUE DEVICES", selector: "hue.*.*.battery", type: "percent" },
  { name: "ZIGBEE DEVICES", selector: "zigbee.*.*.battery", type: "percent" },
  {
    name: "HOMEMATIC IP",
    selector: "hm-rpc.*.*.0.OPERATING_VOLTAGE",
    type: "volt",
  },
  { name: "HOMEMATIC IP", selector: "hm-rpc.*.*.0.LOW_BAT", type: "bool" },
  {
    name: "FULLYBROWSER",
    selector: "fullybrowser.*.*.Info.batteryLevel",
    type: "percent",
  },
];

// --- 2. LOGIK-FUNKTIONEN ---

/**
 * Funktion: getSmartName
 * Sucht den Klarnamen des Geräts und bereinigt technische Anhänge.
 */
function getSmartName(id) {
  const parts = id.split(".");
  let name = "";
  if (parts.length >= 3) {
    const deviceId = `${parts[0]}.${parts[1]}.${parts[2]}`;
    const deviceObj = getObject(deviceId);
    if (deviceObj?.common?.name) {
      name = deviceObj.common.name;
    }
  }
  if (typeof name === "object") name = name.de || name.en;
  if (!name || /percent|battery|low_bat/i.test(name)) {
    name = parts[2] ? parts[2].replace(/_/g, " ") : id;
  }
  return name
    .toString()
    .replace(/:\d+.*$/g, "")
    .replace(/\.battery$|\.percent$|\.low_bat$/i, "")
    .trim();
}

/**
 * Funktion: evaluateVoltage
 * Bewertet die Volt-Zahl je nach Batterietyp (Knopfzelle vs. AA).
 */
function evaluateVoltage(v) {
  const res = {
    status: CONFIG.symbols.ok,
    color: CONFIG.design.colorOk,
    isCrit: false,
  };
  if (v > 3.2) {
    if (v <= CONFIG.thresholds.bigBattCrit) {
      res.status = CONFIG.symbols.crit;
      res.color = CONFIG.design.colorCrit;
      res.isCrit = true;
    } else if (v <= CONFIG.thresholds.bigBattWarn) {
      res.status = CONFIG.symbols.warn;
      res.color = CONFIG.design.colorWarn;
    }
  } else if (v <= 1.5) {
    if (v < 1.1) {
      res.status = CONFIG.symbols.crit;
      res.color = CONFIG.design.colorCrit;
      res.isCrit = true;
    } else if (v <= 1.2) {
      res.status = CONFIG.symbols.warn;
      res.color = CONFIG.design.colorWarn;
    }
  } else {
    if (v < 2.2) {
      res.status = CONFIG.symbols.crit;
      res.color = CONFIG.design.colorCrit;
      res.isCrit = true;
    } else if (v <= 2.5) {
      res.status = CONFIG.symbols.warn;
      res.color = CONFIG.design.colorWarn;
    }
  }
  return res;
}

// --- 3. DATEN-VERARBEITUNG ---

/**
 * Funktion: collectGroupedData
 * Sammelt alle Akkustände, verhindert Dubletten und sortiert nach Ladestand.
 */
async function collectGroupedData() {
  const groups = {};
  const allCritical = [];

  for (const conf of ADAPTER_CONFIG) {
    if (!groups[conf.name]) groups[conf.name] = [];
    const states = $(conf.selector);

    states.each((id) => {
      const state = getState(id);
      if (!state || state.val === null) return;

      const deviceName = getSmartName(id);
      const val = state.val;

      // DEDUPLIZIERUNG: Volt hat Vorrang vor LOW_BAT.
      const existingIdx = groups[conf.name].findIndex((d) => d.device === deviceName);
      if (existingIdx !== -1) {
        if (conf.type === "volt" && groups[conf.name][existingIdx].type === "bool") {
          groups[conf.name].splice(existingIdx, 1);
        } else return;
      }

      // Umwandlung in Zahl zur sicheren Farbberechnung.
      const valNum = conf.type === "bool" ? (val ? 0 : 100) : parseFloat(val);
      const displayValue =
        conf.type === "bool"
          ? val
            ? "low bat"
            : "full bat"
          : `${valNum.toFixed(1)}${conf.type === "percent" ? " %" : " V"}`;

      let color = CONFIG.design.colorOk;
      let status = CONFIG.symbols.ok;
      let isCrit = false;

      // Farb-Einstufung.
      if (conf.type === "percent") {
        if (valNum <= CONFIG.thresholds.crit) {
          color = CONFIG.design.colorCrit;
          status = CONFIG.symbols.crit;
          isCrit = true;
        } else if (valNum <= CONFIG.thresholds.warn) {
          color = CONFIG.design.colorWarn;
          status = CONFIG.symbols.warn;
        }
      } else if (conf.type === "volt") {
        const evalV = evaluateVoltage(valNum);
        color = evalV.color;
        status = evalV.status;
        isCrit = evalV.isCrit;
      } else if (conf.type === "bool" && val) {
        color = CONFIG.design.colorCrit;
        status = CONFIG.symbols.crit;
        isCrit = true;
      }

      if (isCrit) allCritical.push({ name: deviceName, val: displayValue });

      groups[conf.name].push({
        device: deviceName,
        valNum: valNum,
        value: displayValue,
        status: status,
        color: color,
        type: conf.type,
      });
    });
  }

  // Sortierung: Die schwächsten Akkus stehen in ihrer Gruppe oben.
  for (const key in groups) {
    groups[key].sort((a, b) => a.valNum - b.valNum);
  }
  return { groups, allCritical };
}

// --- 4. HTML GENERATOR ---

/**
 * Funktion: buildModernHTML
 * Erzeugt das 4-Spalten-Layout mit High-Contrast Headern.
 */
function buildModernHTML(groupedData) {
  let htmlRows = "";

  for (const [groupName, devices] of Object.entries(groupedData)) {
    if (devices.length === 0) continue;

    // BLAUER HEADER: Hier ist der Fix für deine Lesbarkeit.
    htmlRows += `
            <tr>
                <td colspan="12" style="background: ${CONFIG.design.colorHeader}; color: #ffffff; padding: 8px 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; border-top: 2px solid #000;">
                    ${groupName}
                </td>
            </tr>`;

    // 4-SPALTEN LOGIK
    for (let i = 0; i < devices.length; i += 4) {
      const devArray = [devices[i], devices[i + 1], devices[i + 2], devices[i + 3]];
      const rowColor =
        Math.floor(i / 4) % 2 === 0 ? CONFIG.design.colorBgEven : CONFIG.design.colorBgOdd;

      htmlRows += `<tr style="background-color: ${rowColor}; color: ${CONFIG.design.colorText}; font-size: 11px; height: 32px;">`;

      devArray.forEach((dev, idx) => {
        const d = dev || { device: "", value: "", status: "", color: "" };
        const border = idx > 0 ? "border-left: 1px solid #222;" : "";

        htmlRows += `
                    <td style="padding: 4px 8px; width: 17%; ${border}">${d.device}</td>
                    <td style="text-align: right; width: 6%; color: ${d.color}; font-weight: bold;">${d.value}</td>
                    <td style="text-align: center; width: 2%; color: ${d.color}; font-size: 14px; padding-right: 5px;">${d.status}</td>`;
      });
      htmlRows += `</tr>`;
    }
  }

  return `
        <div style="width: 100%; background: #000; font-family: ${CONFIG.design.fontFamily}; border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                ${htmlRows}
            </table>
        </div>`;
}

// --- 5. BENACHRICHTIGUNG & MAIN ---

async function sendNotifications(criticalDevices) {
  if (criticalDevices.length === 0) return;

  const hour = new Date().getHours();
  const isQuietTime = hour >= 20 || hour < 8;
  const message =
    `⚠️ *Kritische Akkustände!*\n\n` +
    criticalDevices.map((d) => `• ${d.name}: ${d.val}`).join("\n");

  if (CONFIG.useTelegram) {
    sendTo("telegram", "send", {
      text: message,
      parse_mode: "Markdown",
      disable_notification: isQuietTime,
    });
  }

  if (CONFIG.useGotify) {
    const tokenState = await getStateAsync(CONFIG.idGotifyToken);
    if (tokenState?.val) {
      const prio = isQuietTime ? 0 : 1;
      httpPost(
        `https://mygotify.meistermopper.de/message?token=${tokenState.val}`,
        {
          title: "Batterie Alarm",
          message: message,
          priority: prio,
        },
        (error) => {
          if (error) console.error(`[Battery States] Gotify Fehler: ${error}`);
        },
      );
    }
  }
}

async function main() {
  const { groups, allCritical } = await collectGroupedData();
  setState(CONFIG.dpVIS, buildModernHTML(groups), true);
  setState(CONFIG.dpAlarmCount, allCritical.length, true);
  await sendNotifications(allCritical);
}

// Alle 12 Stunden (oder manuell beim Speichern).
schedule("0 */12 * * *", main);
main();
