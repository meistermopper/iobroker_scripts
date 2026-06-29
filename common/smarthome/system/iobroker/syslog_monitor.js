/**
 * Name:   Master-Log-Monitor (v4)
 * Zweck:  Liest 30 Log-Einträge von VM 101, neueste oben, repariert Metadaten.
 */

// --- KONFIGURATION ---
const LOG_DP = "0_userdata.0.ioBroker";
const ANZAHL_ZEILEN = 30; // Erhöht auf 30
const UPDATE_INTERVALL = 30; // Sekunden

// --- INITIALISIERUNG & REPARATUR ---
async function repariereDatenpunkt() {
  if (!existsObject(LOG_DP)) {
    await createStateAsync(LOG_DP, "", {
      name: "ioBroker Master Log",
      type: "string",
      role: "html",
      read: true,
      write: true,
    });
  } else {
    const obj = getObject(LOG_DP);
    if (!obj.common || obj.common.type !== "string") {
      obj.common = obj.common || {};
      obj.common.type = "string";
      obj.common.role = "html";
      await setObjectAsync(LOG_DP, obj);
      console.log(`[Log-Monitor] Metadaten für ${LOG_DP} wurden repariert`);
    }
  }
}

// --- LOG-VERARBEITUNG ---
function updateLog() {
  const fs = require("fs");
  const heute = formatDate(new Date(), "YYYY-MM-DD");
  const logPath = `/opt/iobroker/log/iobroker.${heute}.log`;

  if (fs.existsSync(logPath)) {
    try {
      const data = fs.readFileSync(logPath, "utf8");
      // Zeilen filtern, die letzten 30 nehmen und dann umdrehen (neueste oben)
      const zeilen = data
        .split("\n")
        .filter((z) => z.trim() !== "")
        .slice(-ANZAHL_ZEILEN)
        .reverse();

      let htmlLog = '<div style="font-family: monospace; font-size: 11px; line-height: 1.4;">';
      zeilen.forEach((zeile) => {
        let farbe = "#aaa";
        if (zeile.includes("error")) farbe = "#f44336";
        else if (zeile.includes("warn")) farbe = "#ff9800";
        else if (zeile.includes("info")) farbe = "#4caf50";

        htmlLog += `<div style="color: ${farbe}; border-bottom: 1px solid #222; padding: 4px 0;">${zeile}</div>`;
      });
      htmlLog += "</div>";

      setState(LOG_DP, htmlLog, true);
    } catch (e) {
      console.error("[Log-Monitor] Fehler beim Lesen: " + e);
    }
  }
}

// --- START ---
(async () => {
  await repariereDatenpunkt();
  schedule(`*/${UPDATE_INTERVALL} * * * * *`, updateLog);
  updateLog();
})();
