/* eslint-env es2022 */
/**
 * Name:    EV3 Charge-Master
 * Purpose: Start/stop management for Kia EV3 wallbox charging (fixed 6A / 3.96 kW).
 * Modes:   1. Manual: User triggered via VIS
 *          2. PV Auto: Automated based on PV surplus and home battery SoC
 * Features: Home battery protection, debounced status handling, forced transaction stops.
 */

// --- 1. SETUP: DIGITALE ZENTRALE (21 DATENPUNKTE) ---

const VIN = `bluelink.0.${getState("0_userdata.0.Energie.Kia_e_niro.vin")?.val}`;
const PATH_USER = "0_userdata.0.Energie.Kia_e_niro";

const IDS = {
  // Wallbox (Hardware via OCPP)
  wbStat: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status", // [1] Status (Charging, Preparing...)
  wbTrans: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive", // [2] Steuert den Stromfluss (Transaktion aktiv)
  wbAvail: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.availability", // [3] Reset / Verfügbarkeit
  wbConn: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.connected", // Verbindung zum ioBroker
  unifiReconnect: "unifi-network.0.clients.users.60:09:c3:2f:46:49.reconnect", // [22] Neu verbinden über UniFi
  unifiIsOnline: "unifi-network.0.clients.users.60:09:c3:2f:46:49.isOnline", // [23] WLAN-Verbindungsstatus am UniFi AP

  // Fahrzeugdaten (Cloud)
  soc: `${VIN}.vehicleStatusRaw.Green.BatteryManagement.BatteryRemain.Ratio`, // [4] Ladestand %
  bat12v: `${VIN}.vehicleStatusRaw.Electronics.Battery.Level`, // [5] 12V-Batterieschutz
  conn: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.ConnectorFastening.State`, // [6] Steckerstatus
  remTime: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.Charging.RemainTime`, // [7] Restzeit in Min (vom Fahrzeug gemeldet)
  targetSocSrv: `${VIN}.control.charge_limit_slow`, // [23] Ladeziel (AC) vom Fahrzeug (Steuerungspunkt)
  refreshCar: `${VIN}.control.force_refresh_from_car`, // [8] Fahrzeug aufwecken (Live-Daten)
  refreshSrv: `${VIN}.control.force_refresh_from_server`, // [8b] Server-Status abrufen

  // Energie-Zentrale (Hardware-Werte)
  pvPower: "solax.0.data.acpower", // [9] Aktuelle PV-Leistung in Watt
  pvAverage: "0_userdata.0.Energie.PV.Durchschnitt", // [10] Geglätteter Wert (EMA)
  netPower: "0_userdata.0.Energie.PV.Netzbezug", // [11] Hauszähler (+Bezug/-Einspeisung)
  hausCons: "0_userdata.0.Energie.PV.Hausverbrauch", // [12] Hausverbrauch
  batSocPV: "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)", // [13] Heimspeicher %
  minSocSet: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
  minSocRead: "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",

  // Steuerung & Statistiken (VIS)
  u_auto: `${PATH_USER}.autoladen`, // [14] Schalter: PV-Automatik an/aus (Boolean)
  u_fastCharge: `${PATH_USER}.schnellladen`, // Schalter: Schnellladen 16A an/aus (Boolean)
  u_limit: `${PATH_USER}.Ladeprozent`, // [15] Ziel-SoC Schieberegler
  u_smooth: `${PATH_USER}.Glaettung_Zeit`, // [16] Trägheits-Schieberegler für EMA
  u_power: `${PATH_USER}.Ladeleistung`, // [17] Anzeige Ladeleistung (dynamisch berechnet)
  u_timeDay: `${PATH_USER}.Ladezeit`, // [18] Lademinuten heute
  u_rest: `${PATH_USER}.Restladezeit`, // [19] HH:MM Anzeige
  aliasKm: "alias.0.umrechnen.kia_ladekm", // [20] Gewonnene Reichweite
  aliasDur: "alias.0.umrechnen.kia_ladezeit", // [21] Zeit-Objekt
  u_startChargeRequest: `${PATH_USER}.Start_Charge_Request`, // [NEU] Anforderung zum Starten des Ladevorgangs
  u_startTs: `${PATH_USER}.LastStartTimestamp`, // [PERSISTENCE] Merker für Startzeit
  u_origSoc: `${PATH_USER}.LastOriginalMinSoc`, // [PERSISTENCE] Merker für Batterie-Schutz
  u_prevAuto: `${PATH_USER}.LastPreviousAutoState`, // [PERSISTENCE] Merker für autoladen vor Schnellladen
  u_modeStatus: `${PATH_USER}.Lademodus_Status`, // [NEU] Status für VIS (0=Aus, 1=Normal, 2=Schnell)
  wbLimit:
    "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.configuration.evb_MaximumStationCurrent",
  wbReset: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.0.softReset",

  // Sauna-Verriegelung (Interlock)
  saunaHeatOn: "harvia-fenix.0.heatOn", // Status vom Sauna-Ofen
  saunaLogik: "0_userdata.0.Haushalt.sauna_laeuft", // Status-Flag vom Energiemaster
  u_pausedBySauna: `${PATH_USER}.PausedBySauna`, // Merker für automatische Fortsetzung nach Sauna
};

// --- PARAMETER ---
const PV_START_LIMIT = 4600; // Startgrenze (Sonne muss > 4.6kW + Puffer liefern)
const PV_STOP_LIMIT = 4000; // Stoppgrenze (Ladevorgang pausieren, wenn Überschuss sinkt)
const CAR_CAPACITY_KWH = 81.4;
const RANGE_SUMMER = 550;
const RANGE_WINTER = 450;

// --- TIMING KONSTANTEN ---
const DEBOUNCE_STOP_MS = 45000; // 45 Sek. Wartezeit vor endgültigem Stopp
const RECONNECT_WB_MS = 180000; // 3 Min. Wartezeit vor WLAN-Neuverbindung
const START_REFRESH_DELAY_MS = 75000; // 75 Sek. nach Ladestart: Fahrzeug aufwecken für Restzeit & SoC
const STOP_REFRESH_DELAY_MS = 30000; // 30 Sek. nach bestätigtem Ladestopp: Finalen SoC & Status abrufen
const START_VERIFY_TIMEOUT_MS = 35000; // 35 Sek. maximale Wartezeit auf "Charging"-Status nach Startbefehl
const START_AVAILABILITY_TOGGLE_DELAY_MS = 2000; // 2 Sek. Pause bei Verfügbarkeitswechsel
const START_HANDSHAKE_DELAY_MS = 4000; // 4 Sek. Puffer für OCPP-Handshake nach Re-Aktivierung
// [NEU] Verzögerung vor dem erneuten Versuch des Stopp-Befehls nach dem ersten Versuch.
const FORCE_STOP_RETRY_DELAY_MS = 5000;
// [NEU] Verzögerung während des Verfügbarkeitswechsels, um der Wallbox Zeit zur Verarbeitung zu geben.
const FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS = 2000;
const SOFT_RESET_WAIT_MS = 100000; // 100 Sek. Wartezeit für vollständigen EVBox Kaltstart / Neustart

let startZeitLaden = null; // Merker für Statistik
let originalMinSoc = null; // Merker für Min-SoC bei manuellem Laden
let previousAutoState = null; // Merker für Status von autoladen vor Schnellladen
let stopTimer = null; // Timer zur Entprellung von kurzen Lade-Unterbrechungen
let startRefreshTimer = null; // Timer für Statusabfrage nach Ladestart
let stopRefreshTimer = null; // Timer für Statusabfrage nach Ladeende
let reconnectInterval = null; // Wiederkehrender Watchdog-Intervall für UniFi-Recovery
let offlineStartTime = null; // Zeitstempel für Offline-Dauer
let hasWarnedOcppOffline = false; // Flag to prevent repeated warning logs per script run
// [NEU] Sperrvariable zur Vermeidung von Race Conditions während der Startsequenz.
let isStartingSequenceActive = false;
// [NEU] Sperrvariable zur Vermeidung mehrerer gleichzeitiger Ausführungen von erzwungenen Stopps.
let isForceStopping = false;
// [NEU] Sperrvariable während Stationslimit-Wechsel und Soft-Reset (verhindert vorzeitiges Ladeende durch stopTimer).
let isChangingLimit = false;

// --- 2. INITIALISIERUNG ---

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
  // NEU: Datenpunkt für die Ladestart-Anforderung
  if (!existsState(IDS.u_startChargeRequest))
    await createStateAsync(IDS.u_startChargeRequest, false, {
      type: "boolean",
      name: "Start Charging (Request)",
      role: "button",
    });
  // NEU: Datenpunkt für 16A Schnellladen
  if (!existsState(IDS.u_fastCharge))
    await createStateAsync(IDS.u_fastCharge, false, {
      type: "boolean",
      name: "Schnellladen 16A",
      role: "switch",
    });
  if (!existsState(IDS.u_startTs))
    await createStateAsync(IDS.u_startTs, 0, { type: "number", name: "Start Timestamp" });
  if (!existsState(IDS.u_origSoc))
    await createStateAsync(IDS.u_origSoc, 0, { type: "number", name: "Original MinSoc Backup" });
  if (!existsState(IDS.u_prevAuto))
    await createStateAsync(IDS.u_prevAuto, false, {
      type: "boolean",
      name: "Previous Auto State Backup",
    });
  if (!existsState(IDS.u_modeStatus))
    await createStateAsync(IDS.u_modeStatus, 0, {
      type: "number",
      name: "Lademodus Status (0=Aus, 1=Normal, 2=Schnell)",
      role: "value",
    });
  if (!existsState(IDS.u_pausedBySauna))
    await createStateAsync(IDS.u_pausedBySauna, false, {
      type: "boolean",
      name: "Ladung wegen Sauna pausiert",
      role: "indicator",
    });

  // Laufende Prozesse nach Skript-Neustart wiederherstellen
  if (getState(IDS.wbTrans)?.val === true) {
    startZeitLaden = getState(IDS.u_startTs)?.val || Date.now();
    const savedSoc = getState(IDS.u_origSoc)?.val;
    originalMinSoc = savedSoc !== null && savedSoc !== 0 ? savedSoc : null;
    if (getState(IDS.u_fastCharge)?.val === true) {
      previousAutoState = getState(IDS.u_prevAuto)?.val === true;
    }
    if (getState(IDS.wbStat)?.val === "Charging") {
      setState(IDS.u_power, getCurrentChargePowerW(), true);
    }
  }
  updateChargeModeStatus();

  // Initialen Verbindungsstatus erfassen und Watchdog aktivieren, falls Wallbox offline ist
  const currentConn = existsState(IDS.wbConn) ? !!getState(IDS.wbConn)?.val : false;
  handleWallboxConnectionState(currentConn, true);
}
initLadeSystem();

// --- 2.1 HELPER: ASYNCHRONE PAUSE, LADELEISTUNG & MESSWERTE ---

/**
 * Waits for the wallbox OCPP connection to become true, up to a timeout.
 * @param {number} timeoutMs Maximum wait time in milliseconds
 * @returns {Promise<boolean>} True if connected, false if timeout
 */
async function waitForWallboxConnection(timeoutMs = 45000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const isConn = getState(IDS.wbConn)?.val === true;
    const stat = getState(IDS.wbStat)?.val;
    if (isConn && stat && stat !== "Unavailable") {
      return true;
    }
    await wait(1000);
  }
  const finalConn = getState(IDS.wbConn)?.val === true;
  const finalStat = getState(IDS.wbStat)?.val;
  return finalConn && finalStat !== "Unavailable";
}

/**
 * Sets the wallbox hardware station limit (60 or 160) and triggers a soft reset
 * if the limit changed, waiting actively for the EVBox to reboot and reconnect.
 * @param {number} targetLimit 60 (6A) or 160 (16A)
 */
async function setWallboxStationLimit(targetLimit) {
  const currentVal = Number(getState(IDS.wbLimit)?.val) || 0;
  if (currentVal !== targetLimit) {
    console.log(
      `[EV3 Master] Changing wallbox limit from ${currentVal} to ${targetLimit} (deci-Ampere)...`,
    );
    isChangingLimit = true;
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    try {
      setState(IDS.wbLimit, targetLimit);
      await wait(2000);
      console.log("[EV3 Master] Triggering softReset on wallbox to apply configuration...");
      setState(IDS.wbReset, true);
      console.log(
        `[EV3 Master] Waiting for wallbox reboot & reconnect (100s base wait for EVBox hardware boot)...`,
      );
      // 100 Sekunden Basislaufzeit für vollständigen Kaltstart der EVBox Elvi
      await wait(SOFT_RESET_WAIT_MS);
      // Danach aktiv warten, bis die Box am OCPP-Server wieder online und betriebsbereit ist
      const reconnected = await waitForWallboxConnection(30000);
      if (reconnected) {
        console.log(
          "[EV3 Master] Wallbox successfully reconnected after soft reset with new limit.",
        );
        await wait(5000); // 5 Sekunden Puffer zur Datenpunkt-Stabilisierung
      } else {
        console.error("[EV3 Master] Timeout waiting for wallbox reconnection after soft reset!");
        ev3Notify(
          "⚠️ Wallbox-Neustart: Verbindung nach Soft-Reset noch nicht wiederhergestellt!",
          4,
        );
      }
    } finally {
      isChangingLimit = false;
    }
  } else {
    console.log(`[EV3 Master] Wallbox limit already at ${targetLimit}, no soft reset needed.`);
  }
}

/**
 * Restores normal wallbox limit (60), home battery MinSoc, and previous PV automatic state
 * when fast charging ends.
 */
async function restoreFastChargingState() {
  if (originalMinSoc !== null) {
    setState(IDS.minSocSet, Math.max(0, originalMinSoc));
    console.log(`[EV3 Master] Restored home battery MinSoc to ${originalMinSoc}%.`);
    originalMinSoc = null;
    setState(IDS.u_origSoc, 0, true);
  }

  const restoreAuto =
    previousAutoState !== null ? previousAutoState : getState(IDS.u_prevAuto)?.val === true;
  if (restoreAuto) {
    console.log(
      "[EV3 Master] Fast charging ended: Restoring previous PV automatic (autoladen = true).",
    );
    setState(IDS.u_auto, true);
  }
  previousAutoState = null;
  setState(IDS.u_prevAuto, false, true);
  updateChargeModeStatus();

  // Reset wallbox hardware limit to standard 60 (6A) and apply via soft reset
  await setWallboxStationLimit(60);
}

/**
 * Updates the charge mode status datapoint for VIS:
 * 0: Not charging / Idle
 * 1: PV Surplus charging (autoladen = true)
 * 2: Fast charging (16A / ~11 kW)
 * 3: Manual charging (6A / 4 kW)
 * 4: Paused by sauna (Sauna-Interlock active)
 */
function updateChargeModeStatus() {
  const isCharging = getState(IDS.wbStat)?.val === "Charging";
  const isPausedBySauna = getState(IDS.u_pausedBySauna)?.val === true;
  let status = 0;

  if (isPausedBySauna) {
    status = 4;
  } else if (isCharging) {
    const isFast = !!getState(IDS.u_fastCharge)?.val || Number(getState(IDS.wbLimit)?.val) >= 160;
    const isAuto = !!getState(IDS.u_auto)?.val;
    if (isFast) {
      status = 2;
    } else if (isAuto) {
      status = 1;
    } else {
      status = 3;
    }
  }
  setState(IDS.u_modeStatus, status, true);
}

/**
 * Calculates current charging power dynamically based on configured wallbox station limit.
 * Fallback to 60 (6A / ~4140W) if unset.
 * @returns {number} Charging power in Watts.
 */
function getCurrentChargePowerW() {
  const lim = Number(getState(IDS.wbLimit)?.val) || 60;
  return Math.round((lim / 10) * 230 * 3);
}

/**
 * Checks whether the sauna is currently active (heating or active session).
 * Used for the mutual exclusion interlock between EV3 charging and sauna heating.
 * @returns {boolean} True if sauna is active, false otherwise.
 */
function isSaunaActive() {
  const fenix = existsState(IDS.saunaHeatOn) && getState(IDS.saunaHeatOn)?.val === true;
  const logik = existsState(IDS.saunaLogik) && getState(IDS.saunaLogik)?.val === true;
  return fenix || logik;
}

/**
 * Asynchroner Timer zur Ablaufverzögerung in async-Funktionen.
 * @param {number} ms Millisekunden
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wartet bis der Wallbox-Status auf "Charging" wechselt oder der Timeout abläuft.
 * @param {number} timeoutMs Maximale Wartezeit in Millisekunden
 * @returns {Promise<boolean>} True falls "Charging" erreicht wurde, sonst False
 */
async function waitForChargingState(timeoutMs) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (getState(IDS.wbStat)?.val === "Charging") {
      return true;
    }
    await wait(1000);
  }
  return getState(IDS.wbStat)?.val === "Charging";
}

/**
 * Sammelt alle relevanten Leistungs- und SoC-Werte aus den Datenpunkten.
 * Stellt sicher, dass die Werte Zahlen sind.
 */
function getPowerMetrics() {
  return {
    pvPower: Math.max(0, Number(getState(IDS.pvPower)?.val) || 0),
    pvAverage: Number(getState(IDS.pvAverage)?.val) || 0,
    batSoc: Number(getState(IDS.batSocPV)?.val) || 0,
    evSoc: Number(getState(IDS.soc)?.val) || 0,
  };
}

// --- 3. KOMMUNIKATION ---

/**
 * Führt die intelligente Startsequenz der Wallbox inklusive Verifikations-Watchdog
 * und automatischem Retry-Mechanismus aus.
 * @param {string} reason Grund für den Start (z. B. "PV-Automatik", "VIS-Manual")
 */
async function triggerStartSequence(reason = "PV-Surplus") {
  if (isStartingSequenceActive) {
    console.log(`[EV3 Master] Start sequence already active, skipping (${reason}).`);
    return;
  }

  // SAUNA-VERRIEGELUNG: Start abbrechen, wenn Sauna aktiv ist
  if (isSaunaActive()) {
    console.warn(`[EV3 Master] Start sequence aborted (${reason}): Sauna is currently active!`);
    ev3Notify(`⚠️ EV3-Ladestart (${reason}) blockiert: Sauna ist aktiv!`, 3);
    return;
  }

  // VERBINDUNGS-CHECK: Keine Startsequenz ausführen, wenn Wallbox offline ist
  const isConnected = !!getState(IDS.wbConn)?.val;
  if (!isConnected) {
    console.warn(`[EV3 Master] Start sequence aborted (${reason}): Wallbox is offline!`);
    ev3Notify(
      `⚠️ EV3-Ladestart (${reason}) abgebrochen: Wallbox nicht erreichbar (OCPP offline)!`,
      4,
    );
    return;
  }

  const wbStatus = getState(IDS.wbStat)?.val;
  if (wbStatus === "Charging") {
    console.log(`[EV3 Master] Wallbox is already charging. Skipping start sequence.`);
    return;
  }

  const readyToStart = ["Preparing", "Finishing", "SuspendedEVSE", "SuspendedEV"].includes(
    wbStatus,
  );

  if (!readyToStart) {
    if (wbStatus === "Available") {
      // console.warn(`[EV3 Master] Start (${reason}) aborted: No vehicle detected.`);
      return;
    }
  }

  isStartingSequenceActive = true;
  console.log(
    `[EV3 Master] Starting wallbox sequence for: ${reason} (Current Status: ${wbStatus})`,
  );

  try {
    // --- VERSUCH 1 ---
    console.log("[EV3 Master] Start attempt 1: Toggling availability and setting wbTrans = true.");
    setState(IDS.wbAvail, false);
    await wait(START_AVAILABILITY_TOGGLE_DELAY_MS);
    setState(IDS.wbAvail, true);
    await wait(START_HANDSHAKE_DELAY_MS); // Erhöhter Puffer für den OCPP-Handshake
    setState(IDS.wbTrans, true);

    let started = await waitForChargingState(START_VERIFY_TIMEOUT_MS);

    // --- VERSUCH 2 (AUTOMATISCHER RETRY BEI TIMEOUT / FEHLSCHLAG) ---
    if (!started) {
      const currentStatus = getState(IDS.wbStat)?.val;
      console.warn(
        `[EV3 Master] Start attempt 1 timed out. Wallbox status is '${currentStatus}'. Retrying reset sequence...`,
      );

      setState(IDS.wbTrans, false);
      await wait(FORCE_STOP_RETRY_DELAY_MS);
      setState(IDS.wbAvail, false);
      await wait(START_AVAILABILITY_TOGGLE_DELAY_MS);
      setState(IDS.wbAvail, true);
      await wait(START_HANDSHAKE_DELAY_MS);
      setState(IDS.wbTrans, true);

      started = await waitForChargingState(START_VERIFY_TIMEOUT_MS);
    }

    // --- ERGEBNIS-AUSWERTUNG ---
    if (started) {
      console.log(`[EV3 Master] Wallbox start verified successfully (${reason}).`);
      const currentAmps = (Number(getState(IDS.wbLimit)?.val) || 60) / 10;
      ev3Notify(`🔋 EV3-Ladung gestartet via ${reason} mit ${currentAmps}A`);
    } else {
      const finalStatus = getState(IDS.wbStat)?.val;
      console.error(
        `[EV3 Master] Start failed after retry. Wallbox did not reach 'Charging' state (Status: ${finalStatus}). Reverting wbTrans.`,
      );
      setState(IDS.wbTrans, false);
      ev3Notify(
        `⚠️ EV3 Ladestart fehlgeschlagen: Wallbox reagiert nicht (Status: ${finalStatus})`,
        4,
      );
    }
  } catch (e) {
    console.error(`[EV3 Master] Error during start sequence: ${e.message}`);
    setState(IDS.wbTrans, false);
    ev3Notify(`❌ Fehler bei Ladestart-Sequenz: ${e.message}`, 5);
  } finally {
    isStartingSequenceActive = false;
  }
}

/**
 * [NEU] forceStopCharging()
 * Versucht, den Ladevorgang zu beenden, selbst wenn der Status "hängt".
 * Nutzt den Verfügbarkeitswechsel (Availability-Toggle) als letzten Ausweg.
 * Diese Funktion wird aufgerufen, wenn `transactionActive` auf `false` gesetzt wurde,
 * die Wallbox aber immer noch den Status `Charging` meldet.
 */
async function forceStopCharging() {
  // Gleichzeitige Ausführung verhindern
  if (isForceStopping) {
    console.log("[EV3 Master] Force stop already active, skipping.");
    return;
  }
  isForceStopping = true;
  console.warn("[EV3 Master] Initiating forced charging stop sequence.");

  try {
    // Versuch 1: Sende transactionActive: false erneut
    // Standardweg, um eine Session zu beenden.
    console.log("[EV3 Master] Force stop attempt 1: Setting wbTrans to false.");
    setState(IDS.wbTrans, false);
    // Warten, damit die Wallbox Zeit zur Verarbeitung hat.
    await wait(FORCE_STOP_RETRY_DELAY_MS);

    if (getState(IDS.wbStat)?.val === "Charging") {
      console.warn(
        "[EV3 Master] Force stop attempt 1 failed. Proceeding with Availability Toggle.",
      );
      // Versuch 2: Verfügbarkeitswechsel (Availability-Toggle)
      console.log("[EV3 Master] Force stop attempt 2: Toggling wbAvail (false -> true).");
      setState(IDS.wbAvail, false);
      // Nach dem Deaktivieren warten
      await wait(FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS);
      setState(IDS.wbAvail, true);
      // Vor dem erneuten Stopp-Versuch warten
      await wait(FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS);
      setState(IDS.wbTrans, false);
      ev3Notify("⚠️ Wallbox Ladestop erzwungen (Availability Reset)", 3);
      console.log("[EV3 Master] Force stop attempt 2 completed.");
    } else {
      console.log("[EV3 Master] Forced charging stop successful on first attempt.");
    }
  } catch (e) {
    console.error(`[EV3 Master] Error during forced charging stop: ${e.message}`);
    ev3Notify(`❌ Fehler beim erzwungenen Ladestopp: ${e.message}`, 5);
  } finally {
    isForceStopping = false;
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
      console.log("[EV3 Master] Cleared stopTimer after forced stop.");
    }
    if (startRefreshTimer) {
      clearTimeout(startRefreshTimer);
      startRefreshTimer = null;
    }
    setState(IDS.u_power, 0, true);
    if (startZeitLaden) {
      const stats = updateChargeStatistics(Date.now() - startZeitLaden);
      setState(IDS.u_timeDay, stats.totalMinToday, true);
      ev3Notify(
        `❌ Ladung beendet (forced). Heute geladen: ${stats.formattedTime} (+approx. ${stats.kmToday} km)`,
        1,
      );
      startZeitLaden = null;
      setState(IDS.u_startTs, 0, true);
    }
    if (getState(IDS.u_fastCharge)?.val === true) {
      setState(IDS.u_fastCharge, false, true);
      await restoreFastChargingState();
      console.log("[EV3 Master] Reset u_fastCharge and restored settings after forced stop.");
    } else if (originalMinSoc !== null) {
      setState(IDS.minSocSet, Math.max(0, originalMinSoc));
      ev3Notify(`🔌 Hausbatterie MinSoc auf ${originalMinSoc}% nach erzwungenem Stop eingestellt`);
      originalMinSoc = null;
      setState(IDS.u_origSoc, 0, true);
    }
    if (stopRefreshTimer) clearTimeout(stopRefreshTimer);
    stopRefreshTimer = setTimeout(() => {
      console.log(
        "[EV3 Master] Triggering post-stop vehicle refresh for final SoC and statistics.",
      );
      if (existsState(IDS.refreshCar)) {
        setState(IDS.refreshCar, true);
      }
      stopRefreshTimer = null;
    }, STOP_REFRESH_DELAY_MS);
    updateChargeModeStatus();
  }
}

function ev3Notify(text, prio = 1, spoken = null) {
  sendTo("telegram", "send", { text: text }); // An Telegram senden

  // Token dynamisch auflösen für erhöhte Robustheit
  const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker")?.val;
  if (gotifyToken) {
    const url = `https://mygotify.meistermopper.de/message?token=${gotifyToken}`;
    const payload = { title: "EV3 Master", message: text, priority: prio };
    const options = {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    };

    httpPost(url, payload, options, (err) => {
      if (err) console.error(`[EV3 Master] Gotify Error: ${err}`);
    });
  } else {
    console.warn("[EV3 Master] Gotify Token ist nicht definiert oder leer.");
  }

  // Sprachausgabe tagsüber
  if (compareTime("08:00", "20:00", "between")) {
    // Wenn ein spezieller Sprechtext übergeben wurde (spoken), nutzen wir diesen.
    // Andernfalls nehmen wir den Standardtext.
    let voice = spoken || text;
    voice = voice
      .replace(/%/g, " Prozent")
      .replace(/SOC/gi, "Ladestand")
      .replace(/🔋|🔌|⚠️|🚗|❌/g, "");
    // sendTo("sayit", "say", { text: voice });
  }
}

// --- 4. INTELLIGENTE PV-GLÄTTUNG (EMA) ---

/**
 * Berechnet die durchschnittliche PV-Leistung zur Stabilisierung der Regelung.
 * Reagiert schnell auf Einbrüche, langsam auf Erhöhungen.
 */
schedule("* * * * *", async () => {
  const { pvPower: current, pvAverage: oldAvg, batSoc } = getPowerMetrics();
  const inertia = Number(getState(IDS.u_smooth)?.val) || 10;

  let alpha;
  if (current < oldAvg) {
    // ABFALL: Wenn die Hausbatterie voll ist (>85%), langsamer reagieren (0,2 statt 0,5).
    // Dies verhindert unnötige Ladestopps bei kurzen Wolken.
    alpha = batSoc > 85 ? 0.2 : 0.5;
  } else {
    // ANSTIEG: Wenn die Hausbatterie noch leer ist (<50%), länger auf stabile Sonne warten.
    // Wenn die Batterie voll ist, die Sonne schneller nutzen.
    const dynamicInertia = batSoc > 75 ? Math.max(2, inertia / 2) : inertia;
    alpha = 1 / dynamicInertia;
  }

  const newAvg = alpha * current + (1 - alpha) * oldAvg;
  setState(IDS.pvAverage, Math.round(newAvg), true);
});

// --- 5. AUTOMATISIERUNGS-LOGIK (PV-ÜBERSCHUSS) ---

/**
 * Überwacht den PV-Durchschnitt und schaltet das Laden automatisch,
 * vorausgesetzt der Automatik-Schalter in VIS ist aktiv.
 */
function checkPvAutomation() {
  const isFast = !!getState(IDS.u_fastCharge)?.val; // Schnelllade-Schalter
  if (isFast) return; // Schnellladen hat Vorrang vor PV-Automatik

  // SAUNA-VERRIEGELUNG: Bei Saunabetrieb keine PV-Ladung starten
  if (isSaunaActive()) return;

  const isAuto = !!getState(IDS.u_auto)?.val; // Automatik-Schalter
  const { pvAverage: mittel, batSoc, evSoc } = getPowerMetrics(); // Aktuelle Leistungswerte

  // Abbrechen, wenn Wallbox offline ist
  const isConnected = !!getState(IDS.wbConn)?.val;
  if (!isConnected && mittel > PV_START_LIMIT) {
    if (!hasWarnedOcppOffline) {
      console.warn("[EV3 Master] Start not possible: Wallbox connection missing (OCPP Offline)");
      hasWarnedOcppOffline = true;
    }
  }
  if (!isAuto || !isConnected) return;

  const isTransActive = !!getState(IDS.wbTrans)?.val;
  const _wbStatus = getState(IDS.wbStat)?.val;
  const limitCar = getState(IDS.targetSocSrv)?.val || 100;

  // Diagnose-Log für ausreichenden Überschuss, falls nicht geladen wird
  //if (!isTransActive && (mittel > (PV_START_LIMIT - 500))) {
  //    console.log(`[EV3 Master] Status: ${wbStatus} | PV-Avg: ${mittel}W | Bat-SoC: ${batSoc}% | EV-SoC: ${evSoc}% / Ziel: ${limitCar}%`);
  //}

  // START: Genug Sonne (>4.6kW) und Hausspeicher gut gefüllt (>75%)
  if (
    !isTransActive &&
    !isStartingSequenceActive &&
    mittel > PV_START_LIMIT &&
    batSoc > 75 &&
    evSoc < limitCar
  ) {
    triggerStartSequence("PV-Automatik");
  }

  // STOP: Überschuss sinkt unter Ladeleistung (Pause)
  // oder Ladeziel erreicht
  // oder Wallbox-Verbindung verloren (oben durch !isConnected abgefangen, hier als Redundanz)
  else if (isTransActive && (mittel < PV_STOP_LIMIT || evSoc >= limitCar)) {
    // Detailliertes Logging des Stopp-Grunds
    let reason = "";
    if (mittel < PV_STOP_LIMIT) reason = `Insufficient PV power (${mittel}W < ${PV_STOP_LIMIT}W)`;
    else if (evSoc >= limitCar)
      reason = `Vehicle charging target reached (${evSoc}% >= ${limitCar}%)`;

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

// --- 5.1 SAUNA-VERRIEGELUNG (INTERLOCK) ---

/**
 * Überwacht den Status des Saunaofens (harvia-fenix und Energiemaster).
 * Pausiert die Autoladung sofort, wenn die Sauna heizt, um eine Überlastung
 * des Hausanschlusses zu verhindern, und setzt sie nach Saunabeendigung fort.
 */
function handleSaunaStateChange() {
  const saunaOn = isSaunaActive();
  const isCharging =
    getState(IDS.wbStat)?.val === "Charging" || getState(IDS.wbTrans)?.val === true;
  const wasPaused = getState(IDS.u_pausedBySauna)?.val === true;

  if (saunaOn) {
    if (isCharging && !wasPaused) {
      console.warn(
        "[EV3 Master] Sauna started heating! Pausing EV3 charging to avoid house overload.",
      );
      setState(IDS.u_pausedBySauna, true, true);
      // Ladung stoppen
      setState(IDS.wbTrans, false);
      updateChargeModeStatus();
      ev3Notify(
        "🧖 Sauna heizt: EV3-Ladung pausiert, um Hausanschluss vor Überlastung zu schützen.",
        2,
      );
    }
  } else {
    // Sauna ist aus
    if (wasPaused) {
      console.log("[EV3 Master] Sauna is off. Resuming EV3 charging session...");
      setState(IDS.u_pausedBySauna, false, true);
      updateChargeModeStatus();
      ev3Notify("🧖 Sauna beendet: Setze EV3-Ladung automatisch fort.", 1);

      // Falls Schnellladen aktiv ist, wieder mit 16A starten
      const isFast = !!getState(IDS.u_fastCharge)?.val;
      if (isFast) {
        triggerStartSequence("Schnellladen 16A (nach Sauna)");
      } else {
        const isAuto = !!getState(IDS.u_auto)?.val;
        if (isAuto) {
          checkPvAutomation();
        } else {
          triggerStartSequence("Manuelles Laden (nach Sauna)");
        }
      }
    }
  }
}

if (existsState(IDS.saunaHeatOn)) {
  on({ id: IDS.saunaHeatOn, change: "ne" }, handleSaunaStateChange);
}
if (existsState(IDS.saunaLogik)) {
  on({ id: IDS.saunaLogik, change: "ne" }, handleSaunaStateChange);
}

// [NEU] Listener für den Datenpunkt wbTrans.
// Dieser Listener ist entscheidend für das Erkennen und Beheben von "hängenden" Ladestatuse.
// Wenn `wbTrans` auf `false` wechselt (Stopp-Befehl gesendet), prüfen wir nach einer Verzögerung
// von 10 Sekunden, ob `wbStat` immer noch `Charging` ist, und rufen in diesem Fall `forceStopCharging()` auf.
on({ id: IDS.wbTrans, change: "ne" }, (obj) => {
  if (obj.state.val === false) {
    // 10 Sekunden Verzögerung, um der Wallbox Zeit zur Verarbeitung zu geben
    setTimeout(async () => {
      if (getState(IDS.wbStat)?.val === "Charging") {
        console.warn(
          "[EV3 Master] Wallbox hängt im Status 'Charging' trotz beendeter Transaktion. Erzwinge Stopp.",
        );
        await forceStopCharging();
      }
    }, 10000);
  }
});
// --- 6. ÜBERWACHUNG & STATISTIKEN ---

/**
 * Erfasst die Ladedauer und stellt die Leistungsanzeige ein.
 * Erfasst die Ladedauer, stellt die Leistungsanzeige ein und schützt die Hausbatterie
 * vor Entladung beim manuellen Laden.
 * Berechnet die Statistiken für den aktuellen oder abgeschlossenen Ladevorgang.
 */
function updateChargeStatistics(sessionDurationMs) {
  const dauerMin = Math.max(1, Math.round(sessionDurationMs / 60000)); // Mindestens 1 Minute zählen
  const currentTotalMin = getState(IDS.u_timeDay)?.val || 0;
  const totalMinToday = currentTotalMin + dauerMin;

  // Energie und Reichweite dynamisch anhand des aktuellen Ladelimits berechnen
  const currentPowerW = getCurrentChargePowerW();
  const energyKWh = (totalMinToday / 60) * (currentPowerW / 1000);
  const month = new Date().getMonth();
  const rangeMax = month >= 3 && month <= 10 ? RANGE_SUMMER : RANGE_WINTER;
  const kmToday = Math.round((energyKWh / CAR_CAPACITY_KWH) * rangeMax);

  const h = Math.floor(totalMinToday / 60);
  const m = totalMinToday % 60;
  const formattedTime = h > 0 ? `${h}:${m < 10 ? `0${m}` : m} Std` : `${m} Min`;

  return {
    totalMinToday,
    formattedTime,
    kmToday,
    spokenTime: h > 0 ? `${h} Stunden, ${m} Minuten` : `${m} Minuten`,
  };
}

// Haupt-Überwacher für den Wallbox-Status (z. B. Charging, Preparing, SuspendedEV...)
on({ id: IDS.wbStat, change: "ne" }, (obj) => {
  const status = String(obj.state.val);
  const isAuto = !!getState(IDS.u_auto)?.val;

  // FALL 1: Das Fahrzeug lädt aktiv
  if (status === "Charging") {
    // Falls ein Stop-Timer läuft (kurze Ladeunterbrechung durch z.B. Wolken):
    // Timer abbrechen, da die Ladung direkt fortgesetzt wurde (Hiccup-Schutz).
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
      console.log("[EV3 Master] Short interruption ended, resuming charge");
      return;
    }

    // Startzeitpunkt merken, sofern noch nicht gesetzt (für die tägliche Statistik)
    if (!startZeitLaden) {
      startZeitLaden = Date.now();
      setState(IDS.u_startTs, startZeitLaden, true);

      // 75 Sek. nach Ladestart Fahrzeug aufwecken, um verbleibende Ladedauer & SoC präzise abzurufen
      if (startRefreshTimer) clearTimeout(startRefreshTimer);
      startRefreshTimer = setTimeout(() => {
        if (getState(IDS.wbStat)?.val === "Charging") {
          console.log(
            "[EV3 Master] Triggering post-start vehicle refresh to update SoC and remaining time.",
          );
          if (existsState(IDS.refreshCar)) {
            setState(IDS.refreshCar, true);
          }
        }
        startRefreshTimer = null;
      }, START_REFRESH_DELAY_MS);
    }

    // Dynamische Leistungsanzeige in Abhängigkeit des Wallbox-Limits
    setState(IDS.u_power, getCurrentChargePowerW(), true);
    updateChargeModeStatus();

    // BATTERIESCHUTZ bei manuellem Laden oder Schnellladen:
    // Verhindert, dass der Hausspeicher entleert wird, indem der Min-SoC der Hausbatterie temporär
    // auf den aktuellen SoC-Wert gesetzt wird.
    const isFast = !!getState(IDS.u_fastCharge)?.val;
    if ((!isAuto || isFast) && originalMinSoc === null) {
      originalMinSoc = getState(IDS.minSocRead)?.val;
      setState(IDS.u_origSoc, originalMinSoc, true);
      const currentBatSoc = getState(IDS.batSocPV)?.val;
      // MinSoc sicherheitshalber nicht unter 0 setzen
      setState(IDS.minSocSet, Math.max(0, currentBatSoc));
      const modeName = isFast ? "Schnellladen" : "Manuelles Laden";
      const msg = `${modeName} gestartet. MinSoc auf ${currentBatSoc}% (vorher: ${originalMinSoc}%)`;
      console.log(`[EV3 Master] ${msg}`);
      ev3Notify(`🔋 ${msg}`);
    }
  }

  // FALL 2: Das Fahrzeug stoppt (durch Kabel ziehen, Auto-Ladeziel erreicht, Pause durch PV-Regelung etc.)
  else if (
    startZeitLaden &&
    (status === "Finishing" ||
      status === "Available" ||
      status === "SuspendedEV" ||
      status === "SuspendedEVSE")
  ) {
    if (isChangingLimit) {
      console.log(
        `[EV3 Master] Wallbox limit change in progress. Ignoring intermediate state '${status}'.`,
      );
      return;
    }
    if (startRefreshTimer) {
      clearTimeout(startRefreshTimer);
      startRefreshTimer = null;
    }
    // Um bei kurzen Unterbrechungen nicht sofort abzubrechen, warten wir 45 Sekunden (Entprellzeit).
    // Wechselt der Status in dieser Zeit zurück auf "Charging", läuft die Ladung oben nahtlos weiter.
    if (stopTimer) clearTimeout(stopTimer);

    stopTimer = setTimeout(async () => {
      if (isChangingLimit) {
        console.log("[EV3 Master] Wallbox limit change in progress, aborting stopTimer execution.");
        return;
      }
      // 1. Prüfen, ob der Stopp durch die Sauna ausgelöst wurde (dann Einstellungen für Resume behalten)
      const isPausedBySauna = getState(IDS.u_pausedBySauna)?.val === true;
      if (isPausedBySauna) {
        console.log(
          "[EV3 Master] Charging session is paused by sauna. Preserving fast charge & battery settings for resume.",
        );
        return;
      }

      // 2. Batterieschutz & Einstellungen wiederherstellen
      const wasFast = !!getState(IDS.u_fastCharge)?.val;
      const evSoc = Number(getState(IDS.soc)?.val) || 0;
      const targetSoc = Number(getState(IDS.targetSocSrv)?.val) || 100;
      const isTargetReached = evSoc >= targetSoc;
      const isUnplugged = getState(IDS.wbStat)?.val === "Available";

      // Schnellladen nur zurücksetzen, wenn das Ladeziel erreicht oder das Kabel abgezogen wurde
      if (wasFast && (isTargetReached || isUnplugged)) {
        setState(IDS.u_fastCharge, false, true);
        await restoreFastChargingState();
        console.log(
          "[EV3 Master] Reset u_fastCharge and restored settings (target reached or cable unplugged).",
        );
      } else if (!isAuto && !wasFast && originalMinSoc !== null) {
        setState(IDS.minSocSet, Math.max(0, originalMinSoc));
        const msg = `EV3 Laden beendet. Hausbatterie MinSoc wieder auf ${originalMinSoc}% gestellt`;
        console.log(`[EV3 Master] ${msg}`);
        ev3Notify(`🔌 ${msg}`);
        originalMinSoc = null;
        setState(IDS.u_origSoc, 0, true);
      }

      // 2. Ladestatistik berechnen (Dauer in Min, geladene kWh und hinzugewonnene Kilometer je nach Jahreszeit)
      const stats = updateChargeStatistics(Date.now() - startZeitLaden);
      setState(IDS.u_timeDay, stats.totalMinToday, true);

      // 3. Prüfen, ob das Auto das Ladeziel erreicht hat:
      // Vergleicht den aktuellen SoC des Kia mit dem eingestellten Ladeziel der Wallbox/des Fahrzeugs

      let msgText = `❌ EV3 Ladung beendet. Heute geladen: ${stats.formattedTime} (+approx. ${stats.kmToday} km)`;
      let spokenText = `Ladung beendet. Heute geladen: ${stats.spokenTime}. Reichweite approx. ${stats.kmToday} Kilometer.`;

      // Wenn das Ladeziel erreicht wurde, ergänzen wir die Benachrichtigungen
      if (evSoc >= targetSoc) {
        msgText += ` - Das Ladeziel von ${targetSoc}% wurde erreicht`;
        spokenText += ` Das Ladeziel von ${targetSoc} Prozent wurde erreicht`;
      }

      // Benachrichtigung senden (Telegram, Gotify, Alexa/SayIt)
      ev3Notify(msgText, 1, spokenText);

      // 4. Ladevariablen zurücksetzen & Ladevorgang sauber abschließen
      startZeitLaden = null;
      setState(IDS.u_startTs, 0, true);
      setState(IDS.u_power, 0, true);

      // WICHTIG: Setzt transactionActive auf false, damit die Wallbox die Transaktion beendet
      // und die VIS-Visualisierung nicht mehr "lädt..." anzeigt (Logikfehler-Behebung).
      setState(IDS.wbTrans, false);

      stopTimer = null;
      updateChargeModeStatus();

      // Finalen Status nach Ladeende vom Fahrzeug abrufen
      if (stopRefreshTimer) clearTimeout(stopRefreshTimer);
      stopRefreshTimer = setTimeout(() => {
        console.log(
          "[EV3 Master] Triggering post-stop vehicle refresh for final SoC and statistics.",
        );
        if (existsState(IDS.refreshCar)) {
          setState(IDS.refreshCar, true);
        }
        stopRefreshTimer = null;
      }, STOP_REFRESH_DELAY_MS);
    }, DEBOUNCE_STOP_MS);
  }
});

// Dynamischer Batterieschutz bei manuellem Laden:
// Erhöht sich der SoC des Heimspeichers während des manuellen Ladens (z. B. durch PV-Ertrag),
// wird der Min-SoC des Wechselrichters entsprechend nach oben angepasst.
on({ id: IDS.batSocPV, change: "ne" }, (obj) => {
  const isAuto = !!getState(IDS.u_auto)?.val;
  const isCharging = getState(IDS.wbStat)?.val === "Charging";

  if (!isAuto && isCharging) {
    const newSoc = Number(obj.state.val) || 0;
    const oldSoc = Number(obj.oldState?.val) || 0;

    if (newSoc > oldSoc) {
      if (originalMinSoc === null) {
        originalMinSoc = getState(IDS.minSocRead)?.val;
        setState(IDS.u_origSoc, originalMinSoc, true);
      }
      setState(IDS.minSocSet, Math.max(0, newSoc));
      console.log(
        `[EV3 Master] Manual charging: Home battery SoC increased from ${oldSoc}% to ${newSoc}%. Updated MinSoC to ${newSoc}%.`,
      );
    }
  }
});

// --- 7. ZUSÄTZLICHE FUNKTIONEN ---

/**
 * Evaluates the wallbox connection state and controls the recovery watchdog.
 * Triggers UniFi AP reconnects every 3 minutes if offline and escalates notifications.
 * @param {boolean} isConnected Current OCPP connection status
 * @param {boolean} [isInitial=false] True if called during script startup
 */
function handleWallboxConnectionState(isConnected, isInitial = false) {
  if (!isConnected) {
    if (!offlineStartTime) {
      offlineStartTime = Date.now();
    }
    const wifiStatus = existsState(IDS.unifiIsOnline)
      ? getState(IDS.unifiIsOnline)?.val
        ? "WLAN OK"
        : "WLAN Getrennt"
      : "WLAN Unbekannt";

    console.warn(
      `[EV3 Master] Wallbox connection lost (OCPP Offline, ${wifiStatus}). Watchdog activated.`,
    );

    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        const offlineMinutes = Math.max(1, Math.round((Date.now() - offlineStartTime) / 60000));
        console.warn(
          `[EV3 Master] Wallbox still offline (${offlineMinutes} min, ${wifiStatus}). Triggering UniFi AP reconnect...`,
        );
        if (existsState(IDS.unifiReconnect)) {
          setState(IDS.unifiReconnect, true);
        }

        // Nach 5 Minuten Offline-Zeit erste Push-Warnung senden
        if (offlineMinutes === 5) {
          ev3Notify(
            `⚠️ Wallbox seit 5 Minuten nicht erreichbar! (UniFi Reconnect ausgelöst, ${wifiStatus})`,
            4,
          );
        } else if (offlineMinutes >= 15 && offlineMinutes % 15 === 0) {
          // Nach 15, 30, ... Minuten eskalieren
          ev3Notify(
            `🚨 Wallbox seit ${offlineMinutes} Minuten dauerhaft offline! Bitte Wallbox / Sicherungsautomat prüfen.`,
            5,
          );
        }
      }, RECONNECT_WB_MS);
    }
  } else {
    // Wieder online: Timer stoppen und Status melden
    if (offlineStartTime && !isInitial) {
      const offlineMinutes = Math.max(1, Math.round((Date.now() - offlineStartTime) / 60000));
      console.log(`[EV3 Master] Wallbox connection restored after ${offlineMinutes} min.`);
      if (offlineMinutes >= 3) {
        ev3Notify(`✅ Wallbox wieder online (nach ${offlineMinutes} Min. Unterbrechung).`, 1);
      }
    }
    offlineStartTime = null;
    hasWarnedOcppOffline = false;
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  }
}

/**
 * Verbindungs-Watchdog: Überwacht die Erreichbarkeit der Wallbox.
 */
on({ id: IDS.wbConn, change: "ne" }, (obj) => {
  handleWallboxConnectionState(!!obj.state.val);
});

/**
 * Formatiert die verbleibende Ladezeit für die Anzeige in VIS.
 */
on({ id: IDS.remTime, change: "any" }, (obj) => {
  const m = obj.state.val;
  let t = "0:00";
  if (m > 0) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    t = `${hh}:${mm < 10 ? `0${mm}` : mm}`;
  }
  setState(IDS.u_rest, t, true);
});

// Synchronisiert den VIS-Anzeige-Datenpunkt mit dem echten Ladeziel des Autos
on({ id: IDS.targetSocSrv, change: "ne" }, (obj) => {
  console.log(`[EV3 Master] Charge target sync: Setting VIS slider to ${obj.state.val}%.`);
  setState(IDS.u_limit, obj.state.val, true);
});

// Handler für manuelle Start-Anforderungen
on({ id: IDS.u_startChargeRequest, val: true, change: "any" }, () => {
  if (isSaunaActive()) {
    console.warn("[EV3 Master] Manuelle Startanforderung ignoriert: Sauna ist aktiv!");
    ev3Notify("⚠️ Manuelles Laden nicht möglich: Sauna heizt aktuell!", 3);
    setTimeout(() => {
      setState(IDS.u_startChargeRequest, false, true);
    }, 1000);
    return;
  }
  if (!getState(IDS.wbConn)?.val) {
    console.warn("[EV3 Master] Manuelle Startanforderung ignoriert: Wallbox offline!");
    ev3Notify("⚠️ Manuelles Laden nicht möglich: Wallbox offline (OCPP getrennt)!", 4);
    setTimeout(() => {
      setState(IDS.u_startChargeRequest, false, true);
    }, 1000);
    return;
  }
  console.log("[EV3 Master] Manual start request received via VIS.");
  triggerStartSequence("VIS-Manual");
  setTimeout(() => {
    setState(IDS.u_startChargeRequest, false, true);
  }, 1000);
});

// Handler für 16A-Schnellladen
on({ id: IDS.u_fastCharge, change: "ne" }, async (obj) => {
  const isFast = !!obj.state.val;

  if (isFast) {
    // 1. Verbindung zur Wallbox sicherstellen
    const isConnected = !!getState(IDS.wbConn)?.val;
    if (!isConnected) {
      console.warn(
        "[EV3 Master] Schnellladen abgebrochen: Wallbox nicht verbunden (OCPP offline).",
      );
      ev3Notify("⚠️ Schnellladen nicht möglich: Wallbox nicht verbunden!", 4);
      setTimeout(() => {
        setState(IDS.u_fastCharge, false, true);
      }, 1000);
      return;
    }

    // SAUNA-VERRIEGELUNG: Schnellladen sperren, wenn Sauna aktiv ist
    if (isSaunaActive()) {
      console.warn("[EV3 Master] Schnellladen abgebrochen: Sauna ist aktiv!");
      ev3Notify("⚠️ Schnellladen nicht möglich: Sauna heizt aktuell!", 3);
      setTimeout(() => {
        setState(IDS.u_fastCharge, false, true);
      }, 1000);
      return;
    }

    // 2. Vorherigen Status von autoladen merken und autoladen ausschalten
    const wasAuto = !!getState(IDS.u_auto)?.val;
    previousAutoState = wasAuto;
    setState(IDS.u_prevAuto, wasAuto, true);
    if (wasAuto) {
      console.log(
        "[EV3 Master] Schnellladen gestartet: Schalte PV-Automatik (autoladen) vorübergehend aus.",
      );
      setState(IDS.u_auto, false);
    }

    // 3. Wallbox-Limit auf 160 (16A) setzen und bei Bedarf Soft-Reset ausführen (30s)
    await setWallboxStationLimit(160);

    // 4. Hausbatterie vor Entleerung schützen (Min-SoC einfrieren)
    if (originalMinSoc === null) {
      originalMinSoc = getState(IDS.minSocRead)?.val;
      setState(IDS.u_origSoc, originalMinSoc, true);
      const currentBatSoc = getState(IDS.batSocPV)?.val;
      setState(IDS.minSocSet, Math.max(0, currentBatSoc));
      console.log(
        `[EV3 Master] Schnellladen: Heimspeicher MinSoc auf ${currentBatSoc}% eingefroren (vorher: ${originalMinSoc}%).`,
      );
    }

    // 5. Ladevorgang starten, falls noch nicht aktiv
    const currentStatus = getState(IDS.wbStat)?.val;
    if (currentStatus !== "Charging") {
      await triggerStartSequence("Schnellladen 16A");
    } else {
      setState(IDS.u_power, getCurrentChargePowerW(), true);
      ev3Notify("⚡ Schnellladen aktiv: Ladestrom auf 16A erhöht (~11 kW)");
    }
    updateChargeModeStatus();
  } else {
    console.log(
      "[EV3 Master] Schnellladen deaktiviert: Stoppe Ladung und setze Wallbox auf Standard 6A zurück...",
    );

    // 1. Ladevorgang stoppen, falls aktiv
    if (getState(IDS.wbTrans)?.val === true || getState(IDS.wbStat)?.val === "Charging") {
      setState(IDS.wbTrans, false);
    }

    // 2. Wallbox-Limit, Hausbatterie und autoladen wiederherstellen
    await restoreFastChargingState();

    ev3Notify("🛑 Schnellladen beendet. Wallbox auf Standard 6A zurückgestellt.");
    updateChargeModeStatus();
  }
});

// Sofortige Anpassung der Ladeleistungsanzeige bei Änderung des Limits während der Ladung
on({ id: IDS.wbLimit, change: "ne" }, () => {
  if (getState(IDS.wbStat)?.val === "Charging") {
    setState(IDS.u_power, getCurrentChargePowerW(), true);
  }
  updateChargeModeStatus();
});

// Täglicher Reset der Ladestatistik um 02:05 Uhr
schedule("5 2 * * *", () => {
  setState(IDS.u_timeDay, 0, true);
});

// Schutz der Kia 12V-Starterbatterie
on({ id: IDS.bat12v, change: "ne" }, (obj) => {
  if (obj.state.val <= 50) ev3Notify(`⚠️ Kia 12V battery critical!`, 5);
});
