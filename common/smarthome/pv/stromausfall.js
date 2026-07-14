/* eslint-env es2022 */
/**
 * =============================================================================
 * SKRIPT: NETZ-WÄCHTER (GRID MONITOR) - VERSION 1.2
 * =============================================================================
 * ZWECK: Überwachung Hausanschluss.
 * ANPASSUNG: Keine Sprachausgabe bei Ausfall (da Google-Geräte stromlos).
 * Sprachausgabe erfolgt nur bei Netzkehr.
 * =============================================================================
 */

const dpGridAlarm = "modbus.0.inputRegisters.227.64_Grid_lost_alarm";
const dpPersistPath = "0_userdata.0.System.Netzausfall_Start";
const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker")?.val;
const sayitInstances = ["sayit.0", "sayit.1", "sayit.2", "sayit.3", "sayit.4", "sayit.5"];

async function initGridMonitor() {
  if (!existsState(dpPersistPath)) {
    await createStateAsync(dpPersistPath, 0, {
      name: "Zeitpunkt Netzausfall",
      type: "number",
      role: "value.datetime",
    });
  }
}

function gridNotify(msg, priority = 5) {
  sendTo("telegram", "send", {
    text: `<pre>🌐 NETZ-MONITOR\n\n${msg}</pre>`,
    parse_mode: "HTML",
  });
  if (gotifyToken) {
    httpPost(
      `https://mygotify.meistermopper.de/message?token=${gotifyToken}`,
      {
        title: "Netzstatus Haus",
        message: msg,
        priority: priority,
      },
      (error) => {
        if (error) console.error(`[Stromausfall] Gotify Fehler: ${error}`);
      },
    );
  }
}

/**
 * Sprachansage nur für die Netzkehr.
 */
function speakRecovery(text) {
  // Wir warten 30 Sekunden, damit die Google Minis Zeit zum Booten haben
  setTimeout(() => {
    const vol = 35;
    sayitInstances.forEach((instance) => {
      sendTo(instance, "say", { text: `${vol}; ${text}`, volume: vol });
    });
  }, 30000);
}

on({ id: dpGridAlarm, change: "ne" }, async (obj) => {
  const status = obj.state.val;
  const startTimePersist = getState(dpPersistPath)?.val;

  if (status === 2) {
    // --- NETZAUSFALL ---
    setState(dpPersistPath, Date.now(), true);
    gridNotify(
      `🔌 ALARM: Stromnetz ausgefallen!\nInfo: Sprachausgabe deaktiviert (Geräte stromlos).`,
      8,
    );
    // HINWEIS: Hier kein speak(), da die Hardware aus ist!
  } else if (status === 0 && startTimePersist > 0) {
    // --- NETZKEHR ---
    const dauerMs = Date.now() - startTimePersist;
    const totalMinutes = Math.round(dauerMs / 60000);
    const formatDauer = `${Math.floor(totalMinutes / 60)}:${(totalMinutes % 60).toString().padStart(2, "0")}`;

    gridNotify(`✅ Netz wiederhergestellt.\nDauer: ${formatDauer} Std.`, 5);

    speakRecovery("Die Netzspannung ist wieder da. Alle Systeme fahren hoch.");
    setState(dpPersistPath, 0, true);
  }
});

initGridMonitor();
