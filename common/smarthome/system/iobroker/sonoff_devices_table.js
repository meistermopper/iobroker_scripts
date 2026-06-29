/**
 * SKRIPT: Tasmota Master-Tabelle V34 (Data Accuracy Edition)
 * * ZWECK:
 * - Repariert die 0% RSSI-Anzeige durch dynamische Pfadsuche.
 * - Behält den manuellen Refresh-Button bei (Dialog-Sicherheit).
 * - Ausführliche Kommentierung für dich zum Mitlesen.
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
  // Der Pfad zu deinem HTML-Datenpunkt für VIS.
  dpVIS: "0_userdata.0.Tabellen.SONOFFTabelleVIS.HTMLTableVis",
  // Der Trigger für den Refresh-Button.
  dpTrigger: "0_userdata.0.Tabellen.SONOFFTabelleVIS.RefreshTrigger",

  design: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    colorBgMain: "#111111",
    colorHeader: "linear-gradient(180deg, #265686, #1a3a5c)",
    rssiOk: 70, // Ab 70% Grün.
    rssiWarn: 40, // Ab 40% Gelb, darunter Rot.
  },
};

// --- 2. INTELLIGENTE DATEN-SUCHE ---

/**
 * Funktion: findStateDeep
 * LOGIK: Diese Funktion ist dein "Spürhund". Wenn wir nicht genau wissen,
 * wo ein Wert (z.B. RSSI) liegt, klappert sie alle gängigen Tasmota-Verstecke ab.
 */
function findStateDeep(devicePath, searchKeys, fallback) {
  for (let key of searchKeys) {
    let fullPath = devicePath + "." + key;
    if (existsState(fullPath)) {
      let val = getState(fullPath)?.val;
      // Falls wir eine Zahl oder einen Text finden, der nicht leer ist, nehmen wir ihn.
      if (val !== null && val !== undefined && val !== "") return val;
    }
  }
  return fallback;
}

/**
 * Funktion: getRSSIColor
 * LOGIK: Berechnet die Farbe.
 * WICHTIG: Wir wandeln den Wert erst in einen String um und löschen alles,
 * was keine Zahl ist (wie das %), damit JavaScript sauber rechnen kann.
 */
function getRSSIColor(val) {
  if (val === null || val === undefined) return "#ffffff";
  const num = parseInt(val.toString().replace(/[^\d]/g, ""), 10);

  if (isNaN(num) || num <= 0) return "#ffffff"; // Weiß, wenn kein echter Empfang da ist.
  if (num >= CONFIG.design.rssiOk) return "#4caf50"; // Grün.
  if (num >= CONFIG.design.rssiWarn) return "#ff9800"; // Orange/Gelb.
  return "#f44336"; // Rot.
}

/**
 * Funktion: collectData
 * LOGIK: Hier werden alle Tasmota-Geräte im Sonoff-Adapter gesammelt.
 */
async function collectData() {
  const devices = [];
  // Wir finden alle Geräte über den Versions-Datenpunkt im INFO-Ordner.
  const selector = $(`sonoff.*.*.INFO.Info1_Version`);

  selector.each((id) => {
    const path = id.replace(".INFO.Info1_Version", "");
    const obj = getObject(path);
    const deviceName = obj?.common?.name || path.split(".").pop();

    // RSSI-SUCHE: Wir suchen an allen bekannten Stellen (STATE, Wifi oder Root).
    const rssi = findStateDeep(
      path,
      ["STATE.Wifi.RSSI", "Wifi.RSSI", "Wifi_RSSI", "RSSI"],
      0,
    );

    // UPTIME-SUCHE: Auch hier suchen wir an verschiedenen Stellen.
    const uptime = findStateDeep(path, ["STATE.Uptime", "Uptime"], "---");
    const online = findStateDeep(path, ["alive", "connected"], false);

    // POWER-BUTTONS: Wir suchen alle Schalter des Geräts (POWER, POWER1...).
    const powerStates = [];
    $(`${path}.POWER*`).each((pId) => {
      if (existsState(pId)) {
        powerStates.push({
          id: pId,
          val: getState(pId)?.val,
          label: pId.split(".").pop(),
        });
      }
    });

    devices.push({
      name: deviceName,
      group: deviceName.charAt(0).toUpperCase(),
      online: online,
      type: findStateDeep(path, ["INFO.Info1_Module", "Module"], "Tasmota"),
      ip: findStateDeep(path, ["INFO.Info2_IPAddress", "IPAddress"], "0.0.0.0"),
      rssi: rssi,
      rssiColor: getRSSIColor(rssi),
      uptime: uptime,
      version: getState(id)?.val.split("(")[0],
      power: powerStates,
    });
  });
  return devices;
}

// --- 3. HTML GENERATOR (FRONTEND) ---

function buildHTML(devices) {
  devices.sort((a, b) => a.name.localeCompare(b.name));

  const countTotal = devices.length;
  const countOnline = devices.filter((d) => d.online).length;
  const now = new Date().toLocaleTimeString();

  let htmlRows = "";
  let lastGroup = "";

  devices.forEach((dev, index) => {
    // Buchstaben-Trenner für die alphabetische Liste.
    if (dev.group !== lastGroup) {
      htmlRows += `<tr style="background:#1d1d1d; color:#666; font-size:10px; text-transform:uppercase;"><td colspan="8" style="padding:4px 15px; text-align:left;">${dev.group}</td></tr>`;
      lastGroup = dev.group;
    }

    const bg = index % 2 === 0 ? "#181818" : "#111111";
    const statusColor = dev.online ? "#4caf50" : "#f44336";

    // Die Schalter-Buttons.
    const buttons = dev.power
      .map((p) => {
        const active = p.val === true || p.val === "ON" || p.val === 1;
        return `<button style="background:${active ? "#f44336" : "#dddddd"}; color:${active ? "#fff" : "#000"}; border:none; border-radius:3px; padding:2px 8px; margin:1px; font-weight:bold; cursor:pointer;" onclick="vis.setValue('${p.id}', ${!active})">P</button>`;
      })
      .join("");

    // Tabellenzeile zusammenbauen.
    htmlRows += `
            <tr class="t-row" style="background:${bg}; color:#ececec; height:40px; border-bottom:1px solid #222;">
                <td style="text-align:left; padding-left:15px; font-weight:500;">${dev.name}</td>
                <td style="color:${statusColor}; font-weight:bold; font-size:16px;">${dev.online ? "✓" : "✗"}</td>
                <td style="font-size:11px; opacity:0.7;">${dev.type}</td>
                <td style="color:${dev.rssiColor}; font-weight:bold;">${dev.rssi}%</td>
                <td><a href="http://${dev.ip}" target="_blank" style="color:#4fc3f7; text-decoration:none; background:#2c2c2c; padding:2px 6px; border-radius:4px; font-size:11px;">${dev.ip}</a></td>
                <td style="font-size:11px; opacity:0.6;">${dev.uptime}</td>
                <td>${buttons}</td>
                <td style="font-size:10px; opacity:0.3;">${dev.version}</td>
            </tr>`;
  });

  return `
        <div class="tasmota-ui" style="position:absolute; top:0; left:0; width:100%; height:100%; background:#111; font-family:${CONFIG.design.fontFamily}; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; background:#0e2338; border-bottom:1px solid #333;">
                <input type="text" id="tSearch" placeholder="Filter..." style="flex:1; padding:12px; background:transparent; border:none; color:#fff; outline:none;">
                <button style="background:#265686; border:none; color:white; padding:0 15px; cursor:pointer; font-weight:bold;" onclick="vis.setValue('${CONFIG.dpTrigger}', true)">↻ REFRESH</button>
            </div>
            <div style="flex:1; overflow-y:auto; background: #111;">
                <table id="tTable" style="width:100%; border-collapse:collapse; text-align:center;">
                    <thead style="position:sticky; top:0; z-index:10; background:${CONFIG.design.headerColor}; color:white; font-size:11px; text-transform:uppercase;">
                        <tr style="height:42px;"><th style="text-align:left; padding-left:15px;">Device (${countOnline}/${countTotal})</th><th>Online</th><th>Type</th><th>RSSI</th><th>IP</th><th>Uptime</th><th>Power</th><th>Ver</th></tr>
                    </thead>
                    <tbody>${htmlRows}</tbody>
                </table>
            </div>
            <div style="display:flex; justify-content:space-between; background:#000; padding:4px 15px; font-size:10px; color:#555; border-top:1px solid #333;">
                <div>Stand: ${now}</div>
                <div>Tasmota Master Table V34</div>
            </div>
            <script>
                document.getElementById('tSearch').addEventListener('keyup', function() {
                    let f = this.value.toLowerCase();
                    document.querySelectorAll('#tTable .t-row').forEach(r => {
                        r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none';
                    });
                });
            </script>
        </div>`;
}

// --- 4. ENGINE (ABLAUF) ---

async function run() {
  // Sicherstellen, dass die Datenpunkte existieren.
  if (!existsState(CONFIG.dpVIS))
    await createStateAsync(CONFIG.dpVIS, "", { type: "string", role: "html" });
  if (!existsState(CONFIG.dpTrigger))
    await createStateAsync(CONFIG.dpTrigger, false, {
      type: "boolean",
      role: "button",
    });

  const data = await collectData();
  setState(CONFIG.dpVIS, buildHTML(data), true);

  // Refresh-Trigger zurücksetzen.
  if (
    existsState(CONFIG.dpTrigger) &&
    getState(CONFIG.dpTrigger)?.val === true
  ) {
    setState(CONFIG.dpTrigger, false, true);
  }
}

// --- TRIGGER ---

// Reagiert auf den Refresh-Button.
on({ id: CONFIG.dpTrigger, val: true, change: "any" }, run);

// Alle 10 Minuten automatisches Update (RSSI/Uptime).
schedule("*/10 * * * *", run);

// Sofortstart beim Speichern.
run();
