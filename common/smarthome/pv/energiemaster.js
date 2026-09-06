/* eslint-env es2022 */
/**
 * =============================================================================
 * ENERGIEMASTER v4.0 - PURE PHYSICAL ENGINE
 * =============================================================================
 * ZWECK: Zentrale physikalische Berechnung von Hausverbrauch, Autarkie,
 *        Batterie-Restladezeit und Tagesstatistiken (Wh).
 *
 * FUNKTIONEN:
 * 1. Hausverbrauch & Autarkie: Physikalische Echtzeitberechnung aus PV, Netz und Batterie.
 * 2. Wh-Integration: Kontinuierliche Integration der Energieflüsse für Tagesstatistiken.
 * 3. Batterie-Metriken: Berechnung von Restladezeit (HH:MM) und voraussichtlicher Enduhrzeit.
 * 4. Sommer-Freigabe: Statusflag für die Wallbox-Nutzung in der VIS.
 * 5. Min-SoC Watchdog: Überwacht Änderungen des Min-SoC am Wechselrichter (Spam-Schutz).
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const PATH_PV = "0_userdata.0.Energie.PV.";

const IDS = {
  // Hardware-Eingänge (Wechselrichter & Smartmeter)
  pvPower: "solax.0.data.acpower", // Current PV generation (W)
  pvYield: "solax.0.data.yieldtoday", // PV daily yield (kWh)
  netPower: "smartmeter.0.1-0:16_7_0__255.value", // Grid (+import / -export) (W)
  batPower: "modbus.0.inputRegisters.100.842_Battery_Power_(System)", // Battery (+charge / -discharge) (W)
  batSoc: "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)", // Battery SoC (%)

  // Konfiguration & Überwachung
  speicherMax: `${PATH_PV}Speichergroesse`, // Battery capacity in kWh (e.g. 9.6)
  minSocRead: "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)", // Min-SoC register
  saunaLogik: "0_userdata.0.Haushalt.sauna_laeuft", // Read-only check for notify suppression
};

// Interne Zustände & Messwerte
let isSystemInitialized = false;
let pvP = 0,
  netP = 0,
  batP = 0,
  soc = 0,
  sMax = 9.6;
let tVerbrauchWh = 0,
  tLadungWh = 0,
  tNetzWh = 0,
  lastTs = Date.now();
let statsInterval = null;

// --- 2. INITIALISIERUNG ---
async function initSystem() {
  const states = [
    { id: `${PATH_PV}Hausverbrauch`, unit: "W", type: "number" },
    { id: `${PATH_PV}Netzbezug`, unit: "W", type: "number" },
    { id: `${PATH_PV}Einspeisung`, unit: "W", type: "number" },
    { id: `${PATH_PV}Autarkie`, unit: "%", type: "number" },
    { id: `${PATH_PV}Tagesverbrauch`, unit: "Wh", type: "number" },
    { id: `${PATH_PV}Tageserzeugung`, unit: "Wh", type: "number" },
    { id: `${PATH_PV}Tagesladung`, unit: "Wh", type: "number" },
    { id: `${PATH_PV}TagesNetzbezug`, unit: "Wh", type: "number" },
    { id: `${PATH_PV}lade_kwh`, unit: "kWh", type: "number" },
    { id: `${PATH_PV}Restladezeit`, unit: "h", type: "string" },
    { id: `${PATH_PV}Ladung_final_Uhrzeit`, unit: "", type: "string" },
    { id: `${PATH_PV}Wallbox_Freigabe`, unit: "", type: "boolean" },
  ];

  for (const s of states) {
    if (!existsState(s.id)) {
      const name = s.id.split(".").pop();
      const def = s.type === "boolean" ? false : s.type === "string" ? "" : 0;
      /** @type {any} */
      const stateType = s.type;
      await createStateAsync(s.id, def, {
        name: name,
        type: stateType,
        role: "value",
        unit: s.unit || "",
        read: true,
        write: true,
      });
    }
  }

  // Load configured storage capacity
  if (existsState(IDS.speicherMax)) {
    sMax = parseFloat(getState(IDS.speicherMax)?.val) || 9.6;
  }

  // Initialize live values
  pvP = Number(getState(IDS.pvPower)?.val) || 0;
  netP = Number(getState(IDS.netPower)?.val) || 0;
  batP = Number(getState(IDS.batPower)?.val) || 0;
  soc = Number(getState(IDS.batSoc)?.val) || 0;

  // Restore daily accumulators
  tVerbrauchWh = Number(getState(`${PATH_PV}Tagesverbrauch`)?.val) || 0;
  tLadungWh = Number(getState(`${PATH_PV}Tagesladung`)?.val) || 0;
  tNetzWh = Number(getState(`${PATH_PV}TagesNetzbezug`)?.val) || 0;

  isSystemInitialized = true;
  console.log(
    `[Energiemaster v4.0] Started. Battery Capacity: ${sMax} kWh, SoC: ${soc}%, Battery Power: ${batP}W`,
  );

  runUpdate();
}

// --- 3. PHYSIKALISCHE BERECHNUNGS-ENGINE ---

function runUpdate() {
  if (!isSystemInitialized) return;

  const now = Date.now();
  const diff = now - lastTs;
  if (diff < 100) return; // Prevent excessive recalculation loops

  // Fundamental equation: Hausverbrauch = PV + Netz - Batterie
  // (Battery is negative during discharge, positive during charging)
  let curHausV = pvP + netP - batP;
  if (curHausV < 0) curHausV = 0;

  // Time-integral for energy accumulators
  const h = diff / 3600000;
  tVerbrauchWh += curHausV * h;
  if (batP > 0) tLadungWh += batP * h; // Charge power is positive
  if (netP > 0) tNetzWh += netP * h;
  lastTs = now;

  // Battery charge duration estimation
  const curKwh = (sMax * soc) / 100;
  let ladeEndeUhrzeit = "n.v.",
    ladeDauerAnzeige = "---";

  if (batP > 50) {
    const ladeLeistungKW = batP / 1000;
    const fehlendeKwh = sMax - curKwh;

    if (ladeLeistungKW > 0 && fehlendeKwh > 0) {
      const restStunden = fehlendeKwh / ladeLeistungKW;
      const restSekunden = restStunden * 3600;

      const stunden = Math.floor(restStunden);
      const minuten = Math.floor((restStunden * 60) % 60);
      ladeDauerAnzeige = `${stunden < 10 ? `0${stunden}` : stunden}:${minuten < 10 ? `0${minuten}` : minuten}`;

      const endeDatum = new Date(now + restSekunden * 1000);
      ladeEndeUhrzeit = formatDate(endeDatum, "hh:mm");
    }
  }

  // Self-sufficiency calculation (Autarkie)
  const aut =
    curHausV > 0 ? Math.round(Math.min(100, (1 - Math.max(0, netP) / curHausV) * 100)) : 0;

  // Update dashboard datapoints
  setState(`${PATH_PV}Hausverbrauch`, Math.round(curHausV), true);
  setState(`${PATH_PV}Netzbezug`, Math.max(0, Math.round(netP)), true);
  setState(`${PATH_PV}Einspeisung`, Math.abs(Math.min(0, Math.round(netP))), true);
  setState(`${PATH_PV}Autarkie`, aut, true);
  setState(`${PATH_PV}lade_kwh`, parseFloat(curKwh.toFixed(1)), true);
  setState(`${PATH_PV}Restladezeit`, ladeDauerAnzeige, true);
  setState(`${PATH_PV}Ladung_final_Uhrzeit`, ladeEndeUhrzeit, true);

  // Summer Wallbox advisory flag (for VIS visualization)
  const d = new Date();
  const sommer = d.getMonth() >= 3 && d.getMonth() <= 8 && d.getHours() >= 14 && soc >= 85;
  setState(`${PATH_PV}Wallbox_Freigabe`, sommer, true);
}

// --- 4. TRIGGER & EVENT-LISTENER ---

if (existsState(IDS.pvPower)) {
  on({ id: IDS.pvPower, change: "ne" }, (obj) => {
    pvP = Number(obj.state.val) || 0;
    runUpdate();
  });
}

if (existsState(IDS.netPower)) {
  on({ id: IDS.netPower, change: "ne" }, (obj) => {
    netP = Number(obj.state.val) || 0;
    runUpdate();
  });
}

if (existsState(IDS.batPower)) {
  on({ id: IDS.batPower, change: "ne" }, (obj) => {
    batP = Number(obj.state.val) || 0;
    runUpdate();
  });
}

if (existsState(IDS.batSoc)) {
  on({ id: IDS.batSoc, change: "ne" }, (obj) => {
    soc = Number(obj.state.val) || 0;
    runUpdate();
  });
}

if (existsState(IDS.speicherMax)) {
  on({ id: IDS.speicherMax, change: "ne" }, (obj) => {
    sMax = parseFloat(obj.state.val) || 9.6;
    runUpdate();
  });
}

// Min-SoC Watchdog with sauna notification suppression
if (existsState(IDS.minSocRead)) {
  on({ id: IDS.minSocRead, change: "ne" }, (obj) => {
    if (!isSystemInitialized) return;
    const newVal = obj.state.val;
    const oldVal = obj.oldState ? obj.oldState.val : null;
    if (oldVal !== null && newVal === oldVal) return;

    const text = `Min-SoC Update: Die Hausbatterie wurde auf ${newVal}% geregelt`;

    // Suppress notifications during active sauna session
    const isSaunaActive = existsState(IDS.saunaLogik) && getState(IDS.saunaLogik)?.val === true;
    if (isSaunaActive) {
      console.log(
        `[Energiemaster] Min-SoC Watchdog: Sauna active, notification for ${newVal}% suppressed.`,
      );
    } else {
      if (typeof sendGlobalNotify === "function") {
        sendGlobalNotify(text, "Energiemaster", 1);
      }
      console.log(`[Energiemaster] Min-SoC Watchdog: ${text}`);
    }
  });
}

// Periodic accumulator update (every 10 seconds)
statsInterval = setInterval(() => {
  if (!isSystemInitialized) return;
  const yieldWh = (Number(getState(IDS.pvYield)?.val) || 0) * 1000;
  setState(`${PATH_PV}Tageserzeugung`, Math.round(yieldWh), true);
  setState(`${PATH_PV}Tagesverbrauch`, Math.round(tVerbrauchWh), true);
  setState(`${PATH_PV}Tagesladung`, Math.round(tLadungWh), true);
  setState(`${PATH_PV}TagesNetzbezug`, Math.round(tNetzWh), true);
}, 10000);

// Midnight counter reset
schedule("0 0 * * *", () => {
  tVerbrauchWh = 0;
  tLadungWh = 0;
  tNetzWh = 0;
  console.log("[Energiemaster] Daily energy accumulators reset to 0.");
});

// --- 5. LIFECYCLE CLEANUP ---
onStop((callback) => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  console.log("[Energiemaster v4.0] Stopped and cleaned up timer interval.");
  callback();
});

// Start initialization
initSystem();
