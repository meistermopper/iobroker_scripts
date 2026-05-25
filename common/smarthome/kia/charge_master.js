/**
 * =============================================================================
 * SCRIPT: EV3 CHARGE-MASTER v6.5.4 (Cleaned Gold Standard)
 * =============================================================================
 * CONCEPT: Focused start/stop management for the Kia EV3.
 * STRATEGY: Using fixed 6A (approx. 3.960 kW) for two operating modes:
 * 1. MANUAL: User toggles in VIS (Automation OFF).
 * 2. PV-AUTO: Script toggles based on surplus (Automation ON).
 * CHANGES:
 * - Retention of all statistics and protection functions.
 * - Switching Sayit announcements from hours to minutes if 0 hrs.
 * - Battery protection: During manual charging, the house battery's Min-SoC
 *   is set to the current value to prevent discharge.
 * - After charging ends (even if vehicle ended it), the original Min-SoC is restored.
 * - Voice output temporarily disabled.
 * - Wallbox connection check (OCPP online status).
 * - Optimized time formatting and kilometer calculation.
 * - NEW: Robust charging stop mechanism that triggers a forced stop if the wallbox
 *   status hangs (transactionActive: false, but Status: Charging).
 * - Vehicle Capacity: 81.4 kWh | Range: 550km (Summer) / 450km (Winter).
 * - 45-second debounce when Charging status changed.
 * - No charging start if charging target is reached.
 * - NEW: Intelligent wallbox reset before each charging process to fix start issues.
 * =============================================================================
 */

// --- 1. SETUP: DIGITAL NERVE CENTER (21 DATA POINTS) ---

const VIN = "bluelink.0.KNAFD81A7S6058382";
const PATH_USER = "0_userdata.0.Energie.Kia_e_niro";

const IDS = {
  // Wallbox (Hardware via OCPP)
  wbStat: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status", // [1] Status (Charging, Preparing...)
  wbTrans: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive", // [2] Controls power flow
  wbAvail: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.availability", // [3] Reset / Availability
  wbConn:  "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.connected",      // Connection to ioBroker
  unifiReconnect: "unifi-network.0.clients.users.60:09:c3:2f:46:49.reconnect", // [22] Reconnect via UniFi

  // Vehicle Data (Cloud)
  soc: `${VIN}.vehicleStatusRaw.Green.BatteryManagement.BatteryRemain.Ratio`, // [4] Charge level %
  bat12v: `${VIN}.vehicleStatusRaw.Electronics.Battery.Level`, // [5] 12V Battery protection
  conn: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.ConnectorFastening.State`, // [6] Plug status
  remTime: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.Charging.RemainTime`, // [7] Remaining time in min (reported by vehicle)
  targetSocSrv: `${VIN}.control.charge_limit_slow`, // [23] Charge target (AC) from vehicle (control point)
  refresh: `${VIN}.control.force_refresh`, // [8] Wake up vehicle

  // Energy Center (Hardware Values)
  pvPower: "solax.0.data.acpower", // [9] Current PV Watt
  pvAverage: "0_userdata.0.Energie.PV.Durchschnitt", // [10] Smoothed value (EMA)
  netPower: "0_userdata.0.Energie.PV.Netzbezug", // [11] House meter (+consumption/-feed-in)
  hausCons: "0_userdata.0.Energie.PV.Hausverbrauch", // [12] House self-consumption
  batSocPV: "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)", // [13] Home storage %
  minSocSet: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
  minSocRead: "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",

  // Control & Statistics (VIS)
  u_auto: `${PATH_USER}.autoladen`, // [14] Switch: PV Automatic on/off (Boolean)
  u_limit: `${PATH_USER}.Ladeprozent`, // [15] Target SOC Slider
  u_smooth: `${PATH_USER}.Glaettung_Zeit`, // [16] EMA Inertia Slider
  u_power: `${PATH_USER}.Ladeleistung`, // [17] Display Watt (fixed 3690W)
  u_timeDay: `${PATH_USER}.Ladezeit`, // [18] Charging minutes today
  u_rest: `${PATH_USER}.Restladezeit`, // [19] HH:MM Display
  aliasKm: "alias.0.umrechnen.kia_ladekm", // [20] gained range
  aliasDur: "alias.0.umrechnen.kia_ladezeit", // [21] time object
  u_startChargeRequest: `${PATH_USER}.Start_Charge_Request`, // [NEW] Request to start charging
  u_startTs: `${PATH_USER}.LastStartTimestamp`, // [PERSISTENCE] Merker für Startzeit
  u_origSoc: `${PATH_USER}.LastOriginalMinSoc`, // [PERSISTENCE] Merker für Batterie-Schutz
};

// --- PARAMETERS ---
const PV_START_LIMIT = 4600; // Start threshold (Sun must provide > 4.6kW + buffer)
const PV_STOP_LIMIT = 4000;  // Stop threshold (Pause charging if surplus drops)
const FIXED_CHARGE_W = 3960; // Fixe Leistung bei 6A (220V * 3 Phasen * 6A)
const CAR_CAPACITY_KWH = 81.4;
const RANGE_SUMMER = 550;
const RANGE_WINTER = 450;
const GOTIFY_TOKEN = getState("0_userdata.0.gotifytoken.iobroker").val;

// --- TIMING KONSTANTEN ---
const DEBOUNCE_STOP_MS = 45000;  // 45 sec wait before final stop
const RECONNECT_WB_MS = 180000;  // 3 min wait before WiFi reconnect
// [NEW] Delay before retrying the stop command after the first attempt.
const FORCE_STOP_RETRY_DELAY_MS = 5000;
// [NEW] Delay during the availability toggle to give the wallbox time to process.
const FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS = 2000;

let startZeitLaden = null; // Merker für Statistik
let originalMinSoc = null; // Merker für Min-SoC bei manuellem Laden
let stopTimer = null;      // Timer zur Entprellung von kurzen Lade-Unterbrechungen
let reconnectTimer = null; // Timer für Wallbox-Recovery
let wasOfflineReported = false; // Status für Anti-Spam Meldungen
// [NEW] Lock variable to prevent race conditions during the start sequence.
let isStartingSequenceActive = false;
// [NEW] Lock variable to prevent multiple concurrent forced stop executions.
let isForceStopping = false;

// --- 2. INITIALIZATION ---

async function initLadeSystem() {
  // Erstellt nur noch die für diese Version nötigen Punkte
  if (!existsState(IDS.u_auto))
    await createStateAsync(IDS.u_auto, true, {
      type: "boolean",
      name: "PV Automatic",
    });
  if (!existsState(IDS.u_smooth))
    await createStateAsync(IDS.u_smooth, 10, {
      type: "number",
      name: "EMA Smoothing",
    });
  if (!existsState(IDS.u_limit))
    await createStateAsync(IDS.u_limit, 80, {
      type: "number",
      name: "Charge Target",
    });
  // NEW: Data point for the charge start request
  if (!existsState(IDS.u_startChargeRequest))
    await createStateAsync(IDS.u_startChargeRequest, false, {
      type: "boolean",
      name: "Start Charging (Request)",
      role: "button",
    });
  if (!existsState(IDS.u_startTs))
    await createStateAsync(IDS.u_startTs, 0, { type: "number", name: "Start Timestamp" });
  if (!existsState(IDS.u_origSoc))
    await createStateAsync(IDS.u_origSoc, 0, { type: "number", name: "Original MinSoc Backup" });

  // Restore ongoing processes after script restart
  if (getState(IDS.wbStat).val === "Charging") {
      startZeitLaden = getState(IDS.u_startTs).val || Date.now();
      const savedSoc = getState(IDS.u_origSoc).val;
      originalMinSoc = (savedSoc !== null && savedSoc !== 0) ? savedSoc : null;
      setState(IDS.u_power, FIXED_CHARGE_W, true);
  }
}
initLadeSystem();

// --- 2.1 HELPER: GET CURRENT POWER METRICS ---
/**
 * Collects all relevant power and SoC values from the data points.
 * Ensures that the values are numbers.
 */
function getPowerMetrics() {
    return {
        pvPower: Math.max(0, Number(getState(IDS.pvPower).val) || 0),
        pvAverage: Number(getState(IDS.pvAverage).val) || 0,
        batSoc: Number(getState(IDS.batSocPV).val) || 0,
        evSoc: Number(getState(IDS.soc).val) || 0,
    };
}

// --- 3. COMMUNICATION ---

/**
 * Executes the intelligent start sequence of the wallbox.
 */
async function triggerStartSequence(reason = "PV-Surplus") {
  if (isStartingSequenceActive) return;

  const wbStatus = getState(IDS.wbStat).val;
  const readyToStart = ["Preparing", "Finishing", "SuspendedEVSE", "SuspendedEV"].includes(wbStatus);

  if (!readyToStart) {
    if (wbStatus === "Available") //console.warn(`[EV3 Master] Start (${reason}) abgebrochen: Kein Fahrzeug erkannt.`);
    return;
  }

  isStartingSequenceActive = true;
  console.log(`[EV3 Master] Starting reset sequence for mode: ${reason} (Status: ${wbStatus})`);

  try {
      setState(IDS.wbAvail, false);
      await wait(1500);
      setState(IDS.wbAvail, true);
      await wait(3500); // Increased buffer for OCPP handshake
      setState(IDS.wbTrans, true);
      ev3Notify(`🔋 EV3 charging activated via ${reason} at 6A`);
  } finally {
      isStartingSequenceActive = false;
  }
}

/**
 * [NEW] forceStopCharging()
 * Attempts to end the charging process even if the status "hangs".
 * Uses the availability toggle as a last resort.
 * This function is called if `transactionActive` was set to `false`,
 * but the wallbox still reports the status `Charging`.
 */
async function forceStopCharging() {
    // Prevent concurrent execution
    if (isForceStopping) {
        console.log("[EV3 Master] Force stop already active, skipping.");
        return;
    }
    isForceStopping = true;
    console.warn("[EV3 Master] Initiating forced charging stop sequence.");

    try {
        // Attempt 1: Re-send transactionActive: false
        // Standard way to terminate a session.
        console.log("[EV3 Master] Force stop attempt 1: Setting wbTrans to false.");
        setState(IDS.wbTrans, false);
        // Wait to allow the wallbox to process.
        await wait(FORCE_STOP_RETRY_DELAY_MS);

        if (getState(IDS.wbStat).val === "Charging") {
            console.warn("[EV3 Master] Force stop attempt 1 failed. Proceeding with Availability Toggle.");
            // Attempt 2: Availability-Toggle
            console.log("[EV3 Master] Force stop attempt 2: Toggling wbAvail (false -> true).");
            setState(IDS.wbAvail, false);
            // Wait after deactivating
            await wait(FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS);
            setState(IDS.wbAvail, true);
            // Wait before retrying stop
            await wait(FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS);
            setState(IDS.wbTrans, false);
            ev3Notify("⚠️ Wallbox charge stop forced (Availability Reset).", 3);
            console.log("[EV3 Master] Force stop attempt 2 completed.");
        } else {
            console.log("[EV3 Master] Forced charging stop successful on first attempt.");
        }
    } catch (e) {
        console.error(`[EV3 Master] Error during forced charging stop: ${e.message}`);
        ev3Notify(`❌ Error during forced stop: ${e.message}`, 5);
    } finally {
        isForceStopping = false;
        if (stopTimer) {
            clearTimeout(stopTimer);
            stopTimer = null;
            console.log("[EV3 Master] Cleared stopTimer after forced stop.");
        }
        setState(IDS.u_power, 0, true);
        if (startZeitLaden) {
            const stats = updateChargeStatistics(Date.now() - startZeitLaden);
            setState(IDS.u_timeDay, stats.totalMinToday, true);
            ev3Notify(`❌ Charging ended (forced). Charged today: ${stats.formattedTime} (+approx. ${stats.kmToday} km)`, 1);
            startZeitLaden = null; setState(IDS.u_startTs, 0, true);
        }
        if (originalMinSoc !== null) {
            setState(IDS.minSocSet, Math.max(0, originalMinSoc));
            ev3Notify(`🔌 House battery released at ${originalMinSoc}% after forced stop.`);
            originalMinSoc = null; setState(IDS.u_origSoc, 0, true);
        }
    }
}

function ev3Notify(text, prio = 1, spoken = null) {
  sendTo("telegram", "send", { text: text }); // Send to Telegram

  // Effizienter HTTP-Post statt Shell-Prozess
  const url = `https://mygotify.meistermopper.de/message?token=${GOTIFY_TOKEN}`;
  const payload = { title: "EV3 Master", message: text, priority: prio };
  const options = {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  };

  httpPost(url, payload, options, (err) => {
      if (err) console.error(`[EV3 Master] Gotify Error: ${err}`);
  });

  // Voice output during the day
  if (compareTime("08:00", "20:00", "between")) {
    // Wenn ein spezieller Sprechtext übergeben wurde (spoken), nutzen wir diesen.
    // Andernfalls nehmen wir den Standardtext.
    let voice = spoken || text;
    voice = voice
      .replace(/%/g, " Percent")
      .replace(/SOC/gi, "Charge level")
      .replace(/🔋|🔌|⚠️|🚗|❌/g, "");
    // sendTo("sayit", "say", { text: voice });
  }
}

// --- 4. SMART PV SMOOTHING (EMA) ---

/**
 * Calculates the average PV power to stabilize the control.
 * Reacts quickly to drops, slowly to increases.
 */
schedule("* * * * *", async () => {
  const { pvPower: current, pvAverage: oldAvg, batSoc } = getPowerMetrics();
  const inertia = Number(getState(IDS.u_smooth).val) || 10;

  let alpha;
  if (current < oldAvg) {
    // DROP: If the house battery is full (>85%), react slower (0.2 instead of 0.5).
    // This prevents unnecessary charging stops during short clouds.
    alpha = (batSoc > 85) ? 0.2 : 0.5;
  } else {
    // RISE: If the battery is still empty (<50%), wait longer for stable sun.
    // If the battery is full, take advantage of the sun faster.
    const dynamicInertia = (batSoc > 75) ? Math.max(2, inertia / 2) : inertia;
    alpha = 1 / dynamicInertia;
  }

  const newAvg = alpha * current + (1 - alpha) * oldAvg;
  setState(IDS.pvAverage, Math.round(newAvg), true);
});

// --- 5. AUTOMATION LOGIC (PV SURPLUS) ---

/**
 * Monitors the PV average and switches charging automatically,
 * provided the automatic switch in VIS is active.
 */
function checkPvAutomation() {
  const isAuto = !!getState(IDS.u_auto).val; // Automatic switch
  const { pvAverage: mittel, batSoc, evSoc } = getPowerMetrics(); // Current power metrics

  // Cancel if wallbox is offline
  const isConnected = !!getState(IDS.wbConn).val;
  if (!isConnected && mittel > PV_START_LIMIT) console.warn("[EV3 Master] Start not possible: Wallbox connection missing (OCPP Offline).");
  if (!isAuto || !isConnected) return;

  const isTransActive = !!getState(IDS.wbTrans).val;
  const wbStatus = getState(IDS.wbStat).val;
  const limitCar = getState(IDS.targetSocSrv).val || 100;

  // Diagnostic log for sufficient surplus if not charging
  //if (!isTransActive && (mittel > (PV_START_LIMIT - 500))) {
  //    console.log(`[EV3 Master] Status: ${wbStatus} | PV-Avg: ${mittel}W | Bat-SoC: ${batSoc}% | EV-SoC: ${evSoc}% / Ziel: ${limitCar}%`);
  //}

  // START: Enough sun (>4.6kW) and house storage well filled (>75%)
  if (!isTransActive && !isStartingSequenceActive && mittel > PV_START_LIMIT && batSoc > 75 && evSoc < limitCar) {
      triggerStartSequence("PV-Automatic");
  }

  // STOP: Surplus drops below charging power (pause)
  // or charging target reached
  // or wallbox connection lost (caught by !isConnected at the beginning, but here as redundancy)
  else if (isTransActive && (mittel < PV_STOP_LIMIT || evSoc >= limitCar)) {
    // Detailed logging of the stop reason
    let reason = "";
    if (mittel < PV_STOP_LIMIT) reason = `Insufficient PV power (${mittel}W < ${PV_STOP_LIMIT}W)`;
    else if (evSoc >= limitCar) reason = `Vehicle charging target reached (${evSoc}% >= ${limitCar}%)`;

    if (reason) {
        console.log(`[EV3 Master] Automatically stopped: ${reason}`);
    }

    setState(IDS.wbTrans, false);
    //ev3Notify("EV3 charging ended");
  }
}

// Trigger bei neuen PV-Werten sowie bei Wiederherstellung der Verbindung
on({ id: IDS.pvAverage, change: "ne" }, checkPvAutomation);
on({ id: IDS.soc, change: "ne" }, checkPvAutomation);
on({ id: IDS.wbConn, val: true, change: "ne" }, checkPvAutomation);

// [NEW] Listener for the `wbTrans` data point.
// This listener is crucial for detecting and fixing "hanging" charging statuses.
// If `wbTrans` changes to `false` (stop command sent) but `wbStat` is still `Charging`,
// `forceStopCharging()` is invoked.
on({ id: IDS.wbTrans, change: "ne" }, async (obj) => {
    // Wenn wbTrans auf false geht, aber wbStat immer noch "Charging" ist,
    // bedeutet dies, dass der Stopp-Befehl möglicherweise nicht korrekt verarbeitet wurde.
    if (obj.state.val === false && getState(IDS.wbStat).val === "Charging") {
        await forceStopCharging();
    }
});
// --- 6. MONITORING & STATISTICS ---

/**
 * Records charging duration and sets the power display.
 * Records charging duration, sets the power display, and protects the house battery
 * from discharge during manual charging.
 * Berechnet die Statistiken für den aktuellen oder abgeschlossenen Ladevorgang.
 */
function updateChargeStatistics(sessionDurationMs) {
    const dauerMin = Math.max(1, Math.round(sessionDurationMs / 60000)); // Mindestens 1 Minute zählen
    const currentTotalMin = (getState(IDS.u_timeDay).val || 0);
    const totalMinToday = currentTotalMin + dauerMin;

    // Energie und Reichweite
    const energyKWh = (totalMinToday / 60) * (FIXED_CHARGE_W / 1000);
    const month = new Date().getMonth();
    const rangeMax = (month >= 3 && month <= 10) ? RANGE_SUMMER : RANGE_WINTER;
    const kmToday = Math.round((energyKWh / CAR_CAPACITY_KWH) * rangeMax);

    const h = Math.floor(totalMinToday / 60);
    const m = totalMinToday % 60;
    const formattedTime = h > 0 ? `${h}:${m < 10 ? "0" + m : m} hrs` : `${m} min`;

    return { totalMinToday, formattedTime, kmToday, spokenTime: h > 0 ? `${h} hours, ${m} minutes` : `${m} minutes` };
}

on({ id: IDS.wbStat, change: "ne" }, (obj) => {
  const status = String(obj.state.val);
  const isAuto = !!getState(IDS.u_auto).val;

  if (status === "Charging") {
    // If a stop timer is running: Cancel, as it was just a short hiccup
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
      console.log("[EV3 Master] Short interruption ended, resuming charge...");
      return;
    }

    if (!startZeitLaden) {
        startZeitLaden = Date.now();
        setState(IDS.u_startTs, startZeitLaden, true);
    }

    // Since the box charges rigidly at 6A, we set the fixed Watt value
    setState(IDS.u_power, FIXED_CHARGE_W, true);

    // NEW: Battery protection during manual charging (Automatic OFF)
    if (!isAuto && originalMinSoc === null) {
      originalMinSoc = getState(IDS.minSocRead).val;
      setState(IDS.u_origSoc, originalMinSoc, true);
      const currentBatSoc = getState(IDS.batSocPV).val;
      // Ensure MinSoc doesn't drop below 0
      setState(IDS.minSocSet, Math.max(0, currentBatSoc));
      const msg = `Manual charging started. House battery locked at ${currentBatSoc}% (was: ${originalMinSoc}%)`;
      console.log(`[EV3 Master] ${msg}`);
      ev3Notify(`🔋 ${msg}`);
    }
  } else if (
    startZeitLaden &&
    (status === "Finishing" ||
      status === "Available" ||
      status === "SuspendedEV" ||
      status === "SuspendedEVSE")
  ) {
    // We wait 45 seconds to see if the status jumps back to "Charging" (debouncing)
    if (stopTimer) clearTimeout(stopTimer);

    stopTimer = setTimeout(() => {
      // NEW: Lift battery protection during manual charging
      if (!isAuto && originalMinSoc !== null) {
        // Ensure MinSoc doesn't drop below 0
        setState(IDS.minSocSet, Math.max(0, originalMinSoc));
        const msg = `Manual charging ended. House battery released to ${originalMinSoc}%.`;
        console.log(`[EV3 Master] ${msg}`);
        ev3Notify(`🔌 ${msg}`);
        originalMinSoc = null;
        setState(IDS.u_origSoc, 0, true);
      }

      // Calculate and save statistics
      const stats = updateChargeStatistics(Date.now() - startZeitLaden);
      setState(IDS.u_timeDay, stats.totalMinToday, true);

      ev3Notify(
        `❌ Charging ended. Charged today: ${stats.formattedTime} (+approx. ${stats.kmToday} km)`,
        1,
        `Charging finished. Charged today: ${stats.spokenTime}. Range approx. ${stats.kmToday} kilometers.`
      );

      startZeitLaden = null;
      setState(IDS.u_startTs, 0, true);
      setState(IDS.u_power, 0, true);
      stopTimer = null;
    }, DEBOUNCE_STOP_MS);
  }
});

// --- 7. ADDITIONAL FUNCTIONS ---

/**
 * Connection watchdog: Monitors the reachability of the wallbox.
 * Reports status changes (anti-spam) and triggers a reconnect via UniFi after 3 min offline.
 */
on({ id: IDS.wbConn, change: "ne" }, (obj) => {
  const isConnected = !!obj.state.val;

  if (!isConnected) {
    // Warn only the first time
    if (!wasOfflineReported) {
      //console.warn("[EV3 Master] Wallbox-Verbindung verloren. Reconnect-Timer (3 Min) gestartet.");
      wasOfflineReported = true;
    }
    // Reconnect-Timer starten (falls nicht schon einer läuft)
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        //console.log("[EV3 Master] Performing WiFi reconnect via UniFi AP...");
        setState(IDS.unifiReconnect, true);
        reconnectTimer = null;
      }, RECONNECT_WB_MS);
    }
  } else {
    // Back online: Reset status and stop timer
    if (wasOfflineReported) console.log("[EV3 Master] Wallbox connection restored.");
    wasOfflineReported = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }
});

/**
 * Formats the remaining charging time for display in VIS.
 */
on({ id: IDS.remTime, change: "any" }, (obj) => {
  const m = obj.state.val;
  let t = "0:00";
  if (m > 0) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    t = `${hh}:${mm < 10 ? "0" + mm : mm}`;
  }
  setState(IDS.u_rest, t, true);
});

// Sync VIS display data point with real charging target
on({ id: IDS.targetSocSrv, change: "ne" }, (obj) => {
    console.log(`[EV3 Master] Charge target sync: Setting VIS slider to ${obj.state.val}%.`);
    setState(IDS.u_limit, obj.state.val, true);
});

// Manual Start Request Handler
on({ id: IDS.u_startChargeRequest, val: true, change: "any" }, () => {
    console.log("[EV3 Master] Manual start request received via VIS.");
    triggerStartSequence("VIS-Manual");
    setTimeout(() => {
        setState(IDS.u_startChargeRequest, false, true);
    }, 1000);
});

// Daily reset of charging statistics at 02:05 AM
schedule("5 2 * * *", () => {
  setState(IDS.u_timeDay, 0, true);
});

// Kia 12V starter battery protection
on({ id: IDS.bat12v, change: "ne" }, (obj) => {
  if (obj.state.val <= 50) ev3Notify(`⚠️ Kia 12V battery critical!`, 5);
});
