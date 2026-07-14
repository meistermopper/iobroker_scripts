/* eslint-env es2022 */
/**
 * =============================================================================
 * SKRIPT: EV3 CHARGE-MASTER v6.6.1
 * =============================================================================
 * KONZEPT: Fokussiertes Start-/Stopp-Management für den Kia EV3.
 * STRATEGIE: Nutzung von festen 6A (ca. 3,960 kW) für zwei Betriebsmodi:
 * 1. MANUELL: Benutzer schaltet in VIS (Automatik AUS).
 * 2. PV-AUTO: Skript schaltet basierend auf PV-Überschuss (Automatik AN).
 * ÄNDERUNGEN:
 * - Beibehalt aller Statistiken und Schutzfunktionen.
 * - Umschalten von Sayit-Ansagen von Stunden auf Minuten, wenn Stunden = 0.
 * - Batterieschutz: Beim manuellen Laden wird der Min-SoC des Heimspeichers
 *   auf den aktuellen Wert gesetzt, um eine Entladung zu verhindern.
 * - Nach Ladeende (auch wenn das Fahrzeug es beendet hat) wird der originale Min-SoC wiederhergestellt.
 * - Sprachausgabe temporär deaktiviert.
 * - Wallbox-Verbindungsprüfung (OCPP Online-Status).
 * - Optimierte Zeitformatierung und Kilometerberechnung.
 * - NEU: Robuster Ladestopp-Mechanismus, der einen erzwungenen Stopp auslöst,
 *   wenn der Wallbox-Status hängt (transactionActive: false, aber Status: Charging).
 * - Fahrzeugkapazität: 81,4 kWh | Reichweite: 550km (Sommer) / 450km (Winter).
 * - 45-Sekunden-Entprellung bei Statusänderung von "Charging".
 * - Kein Ladestart, wenn das Ladeziel bereits erreicht ist.
 * - NEU: Intelligenter Wallbox-Reset vor jedem Ladevorgang, um Startprobleme zu beheben.
 * - NEU (v6.6.0): Beendet OCPP Lade-Transaktion (transactionActive: false) nach Ablauf
 *   der Entprellzeit, wenn die Ladung vom Auto suspendiert wurde (z.B. Ladeziel erreicht).
 * - NEU (v6.6.0): Modifizierte Benachrichtigungen (Telegram, Gotify, Alexa/SayIt),
 *   wenn das Ladeziel erreicht wurde.
 * - NEU (v6.6.1): Verzögerte Prüfung für erzwungenen Stopp zur Vermeidung von Race Conditions
 *   und robusterer Ladesitzungs-Wiederherstellung bei Skript-Neustarts.
 * =============================================================================
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

  // Fahrzeugdaten (Cloud)
  soc: `${VIN}.vehicleStatusRaw.Green.BatteryManagement.BatteryRemain.Ratio`, // [4] Ladestand %
  bat12v: `${VIN}.vehicleStatusRaw.Electronics.Battery.Level`, // [5] 12V-Batterieschutz
  conn: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.ConnectorFastening.State`, // [6] Steckerstatus
  remTime: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.Charging.RemainTime`, // [7] Restzeit in Min (vom Fahrzeug gemeldet)
  targetSocSrv: `${VIN}.control.charge_limit_slow`, // [23] Ladeziel (AC) vom Fahrzeug (Steuerungspunkt)
  refresh: `${VIN}.control.force_refresh`, // [8] Fahrzeug aufwecken

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
  u_limit: `${PATH_USER}.Ladeprozent`, // [15] Ziel-SoC Schieberegler
  u_smooth: `${PATH_USER}.Glaettung_Zeit`, // [16] Trägheits-Schieberegler für EMA
  u_power: `${PATH_USER}.Ladeleistung`, // [17] Anzeige Ladeleistung (fix 3960W)
  u_timeDay: `${PATH_USER}.Ladezeit`, // [18] Lademinuten heute
  u_rest: `${PATH_USER}.Restladezeit`, // [19] HH:MM Anzeige
  aliasKm: "alias.0.umrechnen.kia_ladekm", // [20] Gewonnene Reichweite
  aliasDur: "alias.0.umrechnen.kia_ladezeit", // [21] Zeit-Objekt
  u_startChargeRequest: `${PATH_USER}.Start_Charge_Request`, // [NEU] Anforderung zum Starten des Ladevorgangs
  u_startTs: `${PATH_USER}.LastStartTimestamp`, // [PERSISTENCE] Merker für Startzeit
  u_origSoc: `${PATH_USER}.LastOriginalMinSoc`, // [PERSISTENCE] Merker für Batterie-Schutz
};

// --- PARAMETER ---
const PV_START_LIMIT = 4600; // Startgrenze (Sonne muss > 4.6kW + Puffer liefern)
const PV_STOP_LIMIT = 4000; // Stoppgrenze (Ladevorgang pausieren, wenn Überschuss sinkt)
const FIXED_CHARGE_W = 3960; // Fixe Leistung bei 6A (220V * 3 Phasen * 6A)
const CAR_CAPACITY_KWH = 81.4;
const RANGE_SUMMER = 550;
const RANGE_WINTER = 450;

// --- TIMING KONSTANTEN ---
const DEBOUNCE_STOP_MS = 45000; // 45 Sek. Wartezeit vor endgültigem Stopp
const RECONNECT_WB_MS = 180000; // 3 Min. Wartezeit vor WLAN-Neuverbindung
// [NEU] Verzögerung vor dem erneuten Versuch des Stopp-Befehls nach dem ersten Versuch.
const FORCE_STOP_RETRY_DELAY_MS = 5000;
// [NEU] Verzögerung während des Verfügbarkeitswechsels, um der Wallbox Zeit zur Verarbeitung zu geben.
const FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS = 2000;

let startZeitLaden = null; // Merker für Statistik
let originalMinSoc = null; // Merker für Min-SoC bei manuellem Laden
let stopTimer = null; // Timer zur Entprellung von kurzen Lade-Unterbrechungen
let reconnectTimer = null; // Timer für Wallbox-Recovery
let wasOfflineReported = false; // Status für Anti-Spam Meldungen
// [NEU] Sperrvariable zur Vermeidung von Race Conditions während der Startsequenz.
let isStartingSequenceActive = false;
// [NEU] Sperrvariable zur Vermeidung mehrerer gleichzeitiger Ausführungen von erzwungenen Stopps.
let isForceStopping = false;

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
  if (!existsState(IDS.u_startTs))
    await createStateAsync(IDS.u_startTs, 0, { type: "number", name: "Start Timestamp" });
  if (!existsState(IDS.u_origSoc))
    await createStateAsync(IDS.u_origSoc, 0, { type: "number", name: "Original MinSoc Backup" });

  // Laufende Prozesse nach Skript-Neustart wiederherstellen
  if (getState(IDS.wbTrans)?.val === true) {
    startZeitLaden = getState(IDS.u_startTs)?.val || Date.now();
    const savedSoc = getState(IDS.u_origSoc)?.val;
    originalMinSoc = savedSoc !== null && savedSoc !== 0 ? savedSoc : null;
    if (getState(IDS.wbStat)?.val === "Charging") {
      setState(IDS.u_power, FIXED_CHARGE_W, true);
    }
  }
}
initLadeSystem();

// --- 2.1 HELPER: AKTUELLE STROM- UND LEISTUNGSWERTE ABRUFEN ---
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
 * Führt die intelligente Startsequenz der Wallbox aus.
 */
async function triggerStartSequence(reason = "PV-Surplus") {
  if (isStartingSequenceActive) return;

  const wbStatus = getState(IDS.wbStat)?.val;
  const readyToStart = ["Preparing", "Finishing", "SuspendedEVSE", "SuspendedEV"].includes(
    wbStatus,
  );

  if (!readyToStart) {
    if (wbStatus === "Available")
      //console.warn(`[EV3 Master] Start (${reason}) abgebrochen: Kein Fahrzeug erkannt.`);
      return;
  }

  isStartingSequenceActive = true;
  console.log(`[EV3 Master] Starting reset sequence for mode: ${reason} (Status: ${wbStatus})`);

  try {
    setState(IDS.wbAvail, false);
    await wait(1500);
    setState(IDS.wbAvail, true);
    await wait(3500); // Erhöhter Puffer für den OCPP-Handshake
    setState(IDS.wbTrans, true);
    ev3Notify(`🔋 EV3-Ladung aktiviert via ${reason} mit 6A`);
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
    if (originalMinSoc !== null) {
      setState(IDS.minSocSet, Math.max(0, originalMinSoc));
      ev3Notify(`🔌 Hausbatterie MinSoc auf ${originalMinSoc}% nach erzwungenem Stop eingestellt`);
      originalMinSoc = null;
      setState(IDS.u_origSoc, 0, true);
    }
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
  const isAuto = !!getState(IDS.u_auto)?.val; // Automatik-Schalter
  const { pvAverage: mittel, batSoc, evSoc } = getPowerMetrics(); // Aktuelle Leistungswerte

  // Abbrechen, wenn Wallbox offline ist
  const isConnected = !!getState(IDS.wbConn)?.val;
  if (!isConnected && mittel > PV_START_LIMIT)
    console.warn("[EV3 Master] Start not possible: Wallbox connection missing (OCPP Offline)");
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

  // Energie und Reichweite
  const energyKWh = (totalMinToday / 60) * (FIXED_CHARGE_W / 1000);
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
    }

    // Da die Box starr mit 6A lädt (3 Phasen * 230V * 6A = ~3,96 kW), setzen wir den festen Watt-Wert zur Anzeige
    setState(IDS.u_power, FIXED_CHARGE_W, true);

    // BATTERIESCHUTZ bei manuellem Laden (Automatik AUS):
    // Verhindert, dass der Hausspeicher entleert wird, indem der Min-SoC der Hausbatterie temporär
    // auf den aktuellen SoC-Wert gesetzt wird.
    if (!isAuto && originalMinSoc === null) {
      originalMinSoc = getState(IDS.minSocRead)?.val;
      setState(IDS.u_origSoc, originalMinSoc, true);
      const currentBatSoc = getState(IDS.batSocPV)?.val;
      // MinSoc sicherheitshalber nicht unter 0 setzen
      setState(IDS.minSocSet, Math.max(0, currentBatSoc));
      const msg = `Manuelles Laden gestartet. MinSoc auf ${currentBatSoc}% (vorher: ${originalMinSoc}%)`;
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
    // Um bei kurzen Unterbrechungen nicht sofort abzubrechen, warten wir 45 Sekunden (Entprellzeit).
    // Wechselt der Status in dieser Zeit zurück auf "Charging", läuft die Ladung oben nahtlos weiter.
    if (stopTimer) clearTimeout(stopTimer);

    stopTimer = setTimeout(() => {
      // 1. Batterieschutz aufheben: Min-SoC des Hausspeichers wieder auf den ursprünglichen Wert zurückstellen
      if (!isAuto && originalMinSoc !== null) {
        setState(IDS.minSocSet, Math.max(0, originalMinSoc));
        const msg = `EV3 Manuelles Laden beendet. Hausbatterie MinSoc wieder auf ${originalMinSoc}% gestellt`;
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
      const evSoc = Number(getState(IDS.soc)?.val) || 0;
      const targetSoc = Number(getState(IDS.targetSocSrv)?.val) || 100;

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
    }, DEBOUNCE_STOP_MS);
  }
});

// --- 7. ZUSÄTZLICHE FUNKTIONEN ---

/**
 * Verbindungs-Watchdog: Überwacht die Erreichbarkeit der Wallbox.
 * Meldet Statusänderungen (Anti-Spam) und löst nach 3 Min. Offline-Zeit einen Reconnect über den UniFi-AP aus.
 */
on({ id: IDS.wbConn, change: "ne" }, (obj) => {
  const isConnected = !!obj.state.val;

  if (!isConnected) {
    // Nur beim ersten Mal warnen
    if (!wasOfflineReported) {
      //console.warn("[EV3 Master] Wallbox-Verbindung verloren. Reconnect-Timer (3 Min) gestartet.");
      wasOfflineReported = true;
    }
    // Reconnect-Timer starten (falls nicht schon einer läuft)
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        //console.log("[EV3 Master] Führe WLAN-Neuverbindung über UniFi AP aus...");
        setState(IDS.unifiReconnect, true);
        reconnectTimer = null;
      }, RECONNECT_WB_MS);
    }
  } else {
    // Wieder online: Status zurücksetzen und Timer stoppen
    if (wasOfflineReported) console.log("[EV3 Master] Wallbox connection restored.");
    wasOfflineReported = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
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
  console.log("[EV3 Master] Manual start request received via VIS.");
  triggerStartSequence("VIS-Manual");
  setTimeout(() => {
    setState(IDS.u_startChargeRequest, false, true);
  }, 1000);
});

// Täglicher Reset der Ladestatistik um 02:05 Uhr
schedule("5 2 * * *", () => {
  setState(IDS.u_timeDay, 0, true);
});

// Schutz der Kia 12V-Starterbatterie
on({ id: IDS.bat12v, change: "ne" }, (obj) => {
  if (obj.state.val <= 50) ev3Notify(`⚠️ Kia 12V battery critical!`, 5);
});
