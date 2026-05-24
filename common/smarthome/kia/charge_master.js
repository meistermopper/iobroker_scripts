/**
 * =============================================================================
 * SKRIPT: EV3 LADE-MASTER v6.5.4 (Cleaned Gold Standard)
 * =============================================================================
 * KONZEPT: Fokussiertes Start/Stop Management für den Kia EV3.
 * STRATEGIE: Nutzung der fixen 6A (ca. 3,960 kW) für zwei Betriebsmodi:
 * 1. MANUELL: User schaltet in VIS (Automatik AUS).
 * 2. PV-AUTO: Skript schaltet nach Überschuss (Automatik AN).
 * ÄNDERUNGEN:
 * - Beibehaltung aller Statistiken und Schutzfunktionen.
 * - Wechseln der Sayit-Ansagen von Stunden auf Minuten, wenn 0 Std.
 * - Batterieschutz: Bei manuellem Laden wird der Min-SoC der Hausbatterie
 *   auf den aktuellen Wert gesetzt, um eine Entladung zu verhindern.
 * - Nach Ladeende (auch wenn das Fzg beendet hat) wird der ursprüngliche Min-SoC wiederhergestellt.
 * - Sprache temporär ausgeschaltet
 * - Überprüfung der Wallbox-Verbindung (OCPP Online-Status)
 * - Optimierte Zeitformatierung und Kilometer-Berechnung
 * - NEU: Robusterer Ladestopp-Mechanismus, der bei "hängendem" Wallbox-Status
 *   (transactionActive: false, aber Status: Charging) einen erzwungenen Stopp auslöst.
 * - Fahrzeug-Kapazität: 81.4 kWh | Reichweite: 550km (Sommer) / 450km (Winter)
 * - Debounce von 45 Sekunden, wenn Charging geändert wurde
 * - Kein Ladestart, wenn das Ladeziel erreicht wurde
 * - NEU: Intelligenter Wallbox-Reset vor jedem Ladevorgang, um Startprobleme zu beheben.
 * =============================================================================
 */

// --- 1. SETUP: DIE DIGITALE NERVENZENTRALE (21 DATENPUNKTE) ---

const VIN = "bluelink.0.KNAFD81A7S6058382";
const PATH_USER = "0_userdata.0.Energie.Kia_e_niro";

const IDS = {
  // Wallbox (Hardware via OCPP)
  wbStat: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status", // [1] Status (Charging, Preparing...)
  wbTrans:
    "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.transactionActive", // [2] Schaltet den Stromfluss
  wbAvail: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.availability", // [3] Reset / Verfügbarkeit
  wbConn:  "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.connected",      // Verbindung zum ioBroker
  unifiReconnect: "unifi-network.0.clients.users.60:09:c3:2f:46:49.reconnect", // [22] Reconnect via UniFi

  // Fahrzeugdaten (Cloud)
  soc: `${VIN}.vehicleStatusRaw.Green.BatteryManagement.BatteryRemain.Ratio`, // [4] Ladestand %
  bat12v: `${VIN}.vehicleStatusRaw.Electronics.Battery.Level`, // [5] 12V Batterie-Schutz
  conn: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.ConnectorFastening.State`, // [6] Stecker-Status
  remTime: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.Charging.RemainTime`, // [7] Restzeit in Min. (vom Fahrzeug gemeldet)
  targetSocSrv: `${VIN}.control.charge_limit_slow`, // [23] Ladeziel (AC) vom Fahrzeug (Steuerungspunkt)
  refresh: `${VIN}.control.force_refresh`, // [8] Fahrzeug aufwecken

  // Energie-Zentrum (Hardware-Werte)
  pvPower: "solax.0.data.acpower", // [9] PV Watt aktuell
  pvAverage: "0_userdata.0.Energie.PV.Durchschnitt", // [10] Geglätteter Wert (EMA)
  netPower: "0_userdata.0.Energie.PV.Netzbezug", // [11] Hauszähler (+Bezug/-Einspeisung)
  hausCons: "0_userdata.0.Energie.PV.Hausverbrauch", // [12] Eigenverbrauch Haus
  batSocPV: "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)", // [13] Hausspeicher %
  minSocSet: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
  minSocRead: "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",

  // Steuerung & Statistik (VIS)
  u_auto: `${PATH_USER}.autoladen`, // [14] Schalter: PV-Automatik an/aus (Boolean)
  u_limit: `${PATH_USER}.Ladeprozent`, // [15] Ziel-SOC Slider
  u_smooth: `${PATH_USER}.Glaettung_Zeit`, // [16] EMA-Trägheit Slider
  u_power: `${PATH_USER}.Ladeleistung`, // [17] Anzeige Watt (fest 3690W)
  u_timeDay: `${PATH_USER}.Ladezeit`, // [18] Lademinuten heute
  u_rest: `${PATH_USER}.Restladezeit`, // [19] HH:MM Anzeige
  aliasKm: "alias.0.umrechnen.kia_ladekm", // [20] gewonnene Reichweite
  aliasDur: "alias.0.umrechnen.kia_ladezeit", // [21] Zeit-Objekt
  u_startChargeRequest: `${PATH_USER}.Start_Charge_Request`, // [NEW] Request to start charging
  u_startTs: `${PATH_USER}.LastStartTimestamp`, // [PERSISTENCE] Merker für Startzeit
  u_origSoc: `${PATH_USER}.LastOriginalMinSoc`, // [PERSISTENCE] Merker für Batterie-Schutz
};

// --- PARAMETER ---
const PV_START_LIMIT = 4600; // Startschwelle (Sonne muss > 4,6kW + Puffer liefern)
const PV_STOP_LIMIT = 4000;  // Stoppschwelle (Ladevorgang pausieren, wenn Überschuss sinkt)
const FIXED_CHARGE_W = 3960; // Fixe Leistung bei 6A (220V * 3 Phasen * 6A)
const CAR_CAPACITY_KWH = 81.4;
const RANGE_SUMMER = 550;
const RANGE_WINTER = 450;
const GOTIFY_TOKEN = getState("0_userdata.0.gotifytoken.iobroker").val;

// --- TIMING KONSTANTEN ---
const DEBOUNCE_STOP_MS = 45000;  // 45 Sek. warten vor endgültigem Stop
// [NEU] Verzögerung für den erneuten Versuch eines Stopp-Befehls nach dem ersten Versuch.
const FORCE_STOP_RETRY_DELAY_MS = 5000;
// [NEU] Verzögerung während des Availability-Toggles, um der Wallbox Zeit für die Verarbeitung zu geben.
const FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS = 2000; // 2 Sekunden für Availability-Toggle

let startZeitLaden = null; // Merker für Statistik
let originalMinSoc = null; // Merker für Min-SoC bei manuellem Laden
let stopTimer = null;      // Timer zur Entprellung von kurzen Lade-Unterbrechungen
let reconnectTimer = null; // Timer für Wallbox-Recovery
let wasOfflineReported = false; // Status für Anti-Spam Meldungen
// [NEU] Lock-Variable, um Race Conditions beim Start der Ladesequenz zu verhindern.
let isStartingSequenceActive = false; // Lock gegen Race Conditions beim Start
// [NEU] Lock-Variable, um Race Conditions beim erzwungenen Stopp zu verhindern.
let isForceStopping = false; // Lock gegen erneutes Auslösen des erzwungenen Stops

// --- 2. INITIALISIERUNG ---

async function initLadeSystem() {
  // Erstellt nur noch die für diese Version nötigen Punkte
  if (!existsState(IDS.u_auto))
    await createStateAsync(IDS.u_auto, true, {
      type: "boolean",
      name: "PV-Automatik",
    });
  if (!existsState(IDS.u_smooth))
    await createStateAsync(IDS.u_smooth, 10, {
      type: "number",
      name: "EMA-Glättung",
    });
  if (!existsState(IDS.u_limit))
    await createStateAsync(IDS.u_limit, 80, {
      type: "number",
      name: "Ladeziel",
    });
  // NEU: Datenpunkt für den Lade-Start-Request
  if (!existsState(IDS.u_startChargeRequest))
    await createStateAsync(IDS.u_startChargeRequest, false, {
      type: "boolean",
      name: "Ladevorgang starten (Request)",
      role: "button",
    });
  if (!existsState(IDS.u_startTs))
    await createStateAsync(IDS.u_startTs, 0, { type: "number", name: "Startzeitstempel" });
  if (!existsState(IDS.u_origSoc))
    await createStateAsync(IDS.u_origSoc, 0, { type: "number", name: "Original MinSoc Backup" });

  // Wiederherstellung laufender Prozesse nach Skript-Neustart
  if (getState(IDS.wbStat).val === "Charging") {
      startZeitLaden = getState(IDS.u_startTs).val || Date.now();
      const savedSoc = getState(IDS.u_origSoc).val;
      originalMinSoc = (savedSoc !== null && savedSoc !== 0) ? savedSoc : null;
      setState(IDS.u_power, FIXED_CHARGE_W, true);
  }
}
initLadeSystem();

// --- 2.1 HILFSFUNKTION: AKTUELLE LEISTUNGSMETRIKEN ABFRAGEN ---
/**
 * Sammelt alle relevanten Leistungs- und SoC-Werte aus den Datenpunkten.
 * Stellt sicher, dass die Werte als Zahlen vorliegen.
 */
function getPowerMetrics() {
    return {
        pvPower: Math.max(0, Number(getState(IDS.pvPower).val) || 0),
        pvAverage: Number(getState(IDS.pvAverage).val) || 0,
        batSoc: Number(getState(IDS.batSocPV).val) || 0,
        evSoc: Number(getState(IDS.soc).val) || 0,
    };
}

// --- 3. KOMMUNIKATION ---

/**
 * Führt die intelligente Start-Sequenz der Wallbox aus.
 */
async function triggerStartSequence(reason = "PV-Überschuss") {
  if (isStartingSequenceActive) return;

  const wbStatus = getState(IDS.wbStat).val;
  const readyToStart = ["Preparing", "Finishing", "SuspendedEVSE", "SuspendedEV"].includes(wbStatus);

  if (!readyToStart) {
    if (wbStatus === "Available") //console.warn(`[EV3 Master] Start (${reason}) abgebrochen: Kein Fahrzeug erkannt.`);
    return;
  }

  isStartingSequenceActive = true;
  console.log(`[EV3 Master] Starte Reset-Sequenz für Modus: ${reason} (Status: ${wbStatus})`);

  try {
      setState(IDS.wbAvail, false);
      await wait(1500);
      setState(IDS.wbAvail, true);
      await wait(3500); // Erhöhter Puffer für OCPP-Handshake
      setState(IDS.wbTrans, true);
      ev3Notify(`🔋 Das Laden des EV 3 wurde via ${reason} mit 6A aktiviert`);
  } finally {
      isStartingSequenceActive = false;
  }
}

/**
 * [NEU] forceStopCharging()
 * Versucht, den Ladevorgang zu beenden, auch wenn der Status "hängt".
 * Nutzt ggf. den Availability-Toggle als letzten Ausweg.
 * Diese Funktion wird aufgerufen, wenn `transactionActive` auf `false` gesetzt wurde,
 * die Wallbox aber weiterhin den Status `Charging` meldet.
 */
async function forceStopCharging() {
    // Verhindert, dass die Funktion mehrfach gleichzeitig ausgeführt wird.
    if (isForceStopping) {
        console.log("[EV3 Master] Force stop bereits aktiv, überspringe erneuten Aufruf.");
        return;
    }
    isForceStopping = true;
    console.warn("[EV3 Master] Initiating forced charging stop sequence.");

    try {
        // Versuch 1: Einfach nochmal transactionActive auf false setzen
        // Dies ist der Standardweg, um einen Ladevorgang zu beenden.
        console.log("[EV3 Master] Force stop attempt 1: Setting wbTrans to false.");
        setState(IDS.wbTrans, false);
        // Kurze Wartezeit, um der Wallbox Zeit zur Verarbeitung zu geben.
        await wait(FORCE_STOP_RETRY_DELAY_MS);

        if (getState(IDS.wbStat).val === "Charging") {
            console.warn("[EV3 Master] Force stop attempt 1 failed. Proceeding with Availability-Toggle.");
            // Versuch 2: Availability-Toggle
            console.log("[EV3 Master] Force stop attempt 2: Toggling wbAvail (false -> true).");
            setState(IDS.wbAvail, false);
            // Kurze Wartezeit nach dem Deaktivieren der Verfügbarkeit.
            await wait(FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS);
            setState(IDS.wbAvail, true);
            // Kurze Wartezeit nach dem Reaktivieren der Verfügbarkeit, bevor der Stopp-Befehl erneut gesendet wird.
            await wait(FORCE_STOP_AVAILABILITY_TOGGLE_DELAY_MS);
            setState(IDS.wbTrans, false); // Erneut Stopp-Befehl nach Availability-Toggle senden
            ev3Notify("⚠️ Wallbox-Ladestopp erzwungen (Availability-Reset).", 3);
            console.log("[EV3 Master] Force stop attempt 2 completed.");
        } else {
            console.log("[EV3 Master] Forced charging stop successful (first attempt).");
        }
    } catch (e) {
        console.error(`[EV3 Master] Error during forced charging stop: ${e.message}`);
        ev3Notify(`❌ Fehler beim erzwungenen Ladestopp: ${e.message}`, 5);
    } finally {
        isForceStopping = false; // Lock wieder freigeben.
        // Nach einem erzwungenen Stopp sollten wir auch den stopTimer löschen, falls er lief.
        if (stopTimer) {
            clearTimeout(stopTimer);
            stopTimer = null;
            console.log("[EV3 Master] Cleared stopTimer after forced stop.");
        }
        setState(IDS.u_power, 0, true); // Leistungsanzeige zurücksetzen
        if (startZeitLaden) { // Statistik aktualisieren, falls eine Session aktiv war
            const stats = updateChargeStatistics(Date.now() - startZeitLaden);
            setState(IDS.u_timeDay, stats.totalMinToday, true);
            ev3Notify(`❌ Ladung beendet (erzwungen). Heute geladen: ${stats.formattedTime} (+ca. ${stats.kmToday} km)`, 1, `Ladung beendet (erzwungen). Heute geladen: ${stats.spokenTime}. Reichweite ca. ${stats.kmToday} Kilometer.`);
            startZeitLaden = null; setState(IDS.u_startTs, 0, true);
        }
        if (originalMinSoc !== null) { setState(IDS.minSocSet, Math.max(0, originalMinSoc)); ev3Notify(`🔌 Haus-Akku auf ${originalMinSoc}% freigegeben nach erzwungenem Stopp.`); originalMinSoc = null; setState(IDS.u_origSoc, 0, true); }
    }
}

function ev3Notify(text, prio = 1, spoken = null) {
  sendTo("telegram", "send", { text: text });

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

// --- 4. SMART PV-GLÄTTUNG (EMA) ---

/**
 * Errechnet den Durchschnitt der PV-Leistung zur Stabilisierung der Regelung.
 * Reagiert bei Abfall schnell, bei Anstieg träge.
 */
schedule("* * * * *", async () => {
  const { pvPower: current, pvAverage: oldAvg, batSoc } = getPowerMetrics();
  const inertia = Number(getState(IDS.u_smooth).val) || 10;

  let alpha;
  if (current < oldAvg) {
    // ABFALL: Wenn der Haus-Akku voll ist (>85%), reagieren wir träger (0.2 statt 0.5).
    // Das verhindert unnötige Ladestopps bei kurzen Wolken.
    alpha = (batSoc > 85) ? 0.2 : 0.5;
  } else {
    // ANSTIEG: Wenn der Akku noch leer ist (<50%), warten wir länger auf stabile Sonne.
    // Ist der Akku voll, nehmen wir die Sonne schneller mit.
    const dynamicInertia = (batSoc > 75) ? Math.max(2, inertia / 2) : inertia;
    alpha = 1 / dynamicInertia;
  }

  const newAvg = alpha * current + (1 - alpha) * oldAvg;
  setState(IDS.pvAverage, Math.round(newAvg), true);
});

// --- 5. AUTOMATIONS-LOGIK (PV-ÜBERSCHUSS) ---

/**
 * Überwacht den PV-Durchschnitt und schaltet die Ladung automatisch,
 * sofern der Automatik-Schalter in der VIS aktiv ist.
 */
function checkPvAutomation() {
  const isAuto = !!getState(IDS.u_auto).val; // Automatik-Schalter
  const { pvAverage: mittel, batSoc, evSoc } = getPowerMetrics(); // Aktuelle Leistungsmetriken

  // Abbrechen, wenn Wallbox offline ist
  const isConnected = !!getState(IDS.wbConn).val;
  if (!isConnected && mittel > PV_START_LIMIT) console.warn("[EV3 Master] Start wegen fehlender WB-Verbindung (OCPP Offline) nicht möglich.");
  if (!isAuto || !isConnected) return;

  const isTransActive = !!getState(IDS.wbTrans).val;
  const wbStatus = getState(IDS.wbStat).val;
  const limitCar = getState(IDS.targetSocSrv).val || 100;

  // Diagnose-Log bei ausreichendem Überschuss, falls nicht geladen wird
  //if (!isTransActive && (mittel > (PV_START_LIMIT - 500))) {
  //    console.log(`[EV3 Master] Status: ${wbStatus} | PV-Avg: ${mittel}W | Bat-SoC: ${batSoc}% | EV-SoC: ${evSoc}% / Ziel: ${limitCar}%`);
  //}

  // START: Genügend Sonne (>4,6kW) und Hausspeicher gut gefüllt (>75%)
  if (!isTransActive && !isStartingSequenceActive && mittel > PV_START_LIMIT && batSoc > 75 && evSoc < limitCar) {
      triggerStartSequence("PV-Automatik");
  }

  // STOP: Überschuss sinkt unter die Ladeleistung (Pausierung)
  // oder Ladeziel erreicht
  // oder Wallbox-Verbindung verloren (wird durch !isConnected am Anfang abgefangen, aber hier als Redundanz)
  else if (isTransActive && (mittel < PV_STOP_LIMIT || evSoc >= limitCar)) {
    // Detailliertes Logging der Stop-Ursache
    let reason = "";
    if (mittel < PV_STOP_LIMIT) reason = `Zu wenig PV-Leistung (${mittel}W < ${PV_STOP_LIMIT}W)`;
    else if (evSoc >= limitCar) reason = `Fahrzeug-Ladeziel erreicht (${evSoc}% >= ${limitCar}%)`;

    if (reason) {
        console.log(`[EV3 Master] Automatisch gestoppt: ${reason}`);
    }

    setState(IDS.wbTrans, false);
    //ev3Notify("Das Laden des EV 3 wurde beendet");
  }
}

// Trigger bei neuen PV-Werten sowie bei Wiederherstellung der Verbindung
on({ id: IDS.pvAverage, change: "ne" }, checkPvAutomation);
on({ id: IDS.soc, change: "ne" }, checkPvAutomation);
on({ id: IDS.wbConn, val: true, change: "ne" }, checkPvAutomation);

// [NEU] Listener für den `wbTrans` Datenpunkt.
// Dieser Listener ist entscheidend für die Erkennung und Behebung von "hängenden" Ladestati.
// Wenn `wbTrans` auf `false` wechselt (d.h., ein Stopp-Befehl wurde gesendet),
// aber der `wbStat` der Wallbox immer noch `Charging` anzeigt, wird `forceStopCharging()` aufgerufen.
// NEU: Listener für wbTrans, um "hängende" Ladestati zu erkennen und zu beheben
on({ id: IDS.wbTrans, change: "ne" }, async (obj) => {
    // Wenn wbTrans auf false geht, aber wbStat immer noch "Charging" ist,
    // bedeutet dies, dass der Stopp-Befehl möglicherweise nicht korrekt verarbeitet wurde.
    if (obj.state.val === false && getState(IDS.wbStat).val === "Charging") {
        await forceStopCharging();
    }
});
// --- 6. MONITORING & STATISTIK ---

/**
 * Erfasst Ladedauer und setzt die Leistungsanzeige.
 * Erfasst Ladedauer, setzt die Leistungsanzeige und schützt bei manuellem
 * Laden die Hausbatterie vor Entladung.
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
    const formattedTime = h > 0 ? `${h}:${m < 10 ? "0" + m : m} Std` : `${m} Min`;

    return { totalMinToday, formattedTime, kmToday, spokenTime: h > 0 ? `${h} Std, ${m} Min` : `${m} Min` };
}

on({ id: IDS.wbStat, change: "ne" }, (obj) => {
  const status = String(obj.state.val);
  const isAuto = !!getState(IDS.u_auto).val;

  if (status === "Charging") {
    // Falls ein Stop-Timer läuft: Abbrechen, da es nur ein kurzer Schluckauf war
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
      console.log("[EV3 Master] Kurze Unterbrechung beendet, lade weiter...");
      return;
    }

    if (!startZeitLaden) {
        startZeitLaden = Date.now();
        setState(IDS.u_startTs, startZeitLaden, true);
    }

    // Da die Box starr 6A lädt, setzen wir den festen Watt-Wert
    setState(IDS.u_power, FIXED_CHARGE_W, true);

    // NEU: Batterieschutz bei manuellem Laden (Automatik AUS)
    if (!isAuto && originalMinSoc === null) {
      originalMinSoc = getState(IDS.minSocRead).val;
      setState(IDS.u_origSoc, originalMinSoc, true);
      const currentBatSoc = getState(IDS.batSocPV).val;
      // Sicherstellen, dass der MinSoc nicht unter 0 fällt
      setState(IDS.minSocSet, Math.max(0, currentBatSoc));
      const msg = `Manuelles Laden gestartet. Haus-Akku auf ${currentBatSoc}% gesperrt (vorher: ${originalMinSoc}%)`;
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
    // Wir warten 45 Sekunden, ob der Status wieder auf "Charging" springt (Entprellung)
    if (stopTimer) clearTimeout(stopTimer);

    stopTimer = setTimeout(() => {
      // NEU: Batterieschutz bei manuellem Laden aufheben
      if (!isAuto && originalMinSoc !== null) {
        // Sicherstellen, dass der MinSoc nicht unter 0 fällt
        setState(IDS.minSocSet, Math.max(0, originalMinSoc));
        const msg = `Manuelles Laden beendet. Haus-Akku auf ${originalMinSoc}% freigegeben.`;
        console.log(`[EV3 Master] ${msg}`);
        ev3Notify(`🔌 ${msg}`);
        originalMinSoc = null;
        setState(IDS.u_origSoc, 0, true);
      }

      // Statistik berechnen und speichern
      const stats = updateChargeStatistics(Date.now() - startZeitLaden);
      setState(IDS.u_timeDay, stats.totalMinToday, true);

      ev3Notify(
        `❌ Ladung beendet. Heute geladen: ${stats.formattedTime} (+ca. ${stats.kmToday} km)`,
        1,
        `Ladung beendet. Heute geladen: ${stats.spokenTime}. Reichweite ca. ${stats.kmToday} Kilometer.`
      );

      startZeitLaden = null;
      setState(IDS.u_startTs, 0, true);
      setState(IDS.u_power, 0, true);
      stopTimer = null;
    }, DEBOUNCE_STOP_MS);
  }
});

// --- 7. ZUSATZFUNKTIONEN ---

/**
 * Verbindungswächter: Überwacht die Erreichbarkeit der Wallbox.
 * Meldet Statusänderungen (Anti-Spam) und triggert nach 3 Min. Offline einen Reconnect via UniFi.
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
        //console.log("[EV3 Master] Führe WiFi-Reconnect der Wallbox via UniFi Accesspoint aus...");
        setState(IDS.unifiReconnect, true);
        reconnectTimer = null;
      }, RECONNECT_WB_MS);
    }
  } else {
    // Wieder da: Status zurücksetzen und Timer stoppen
    if (wasOfflineReported) console.log("[EV3 Master] Wallbox-Verbindung wiederhergestellt.");
    wasOfflineReported = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }
});

/**
 * Formatiert die verbleibende Ladezeit für die Anzeige in der VIS.
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

// NEU: Synchronisierung des VIS-Anzeige-Datenpunkts mit dem echten Ladeziel
on({ id: IDS.targetSocSrv, change: "ne" }, (obj) => {
    console.log(`[EV3 Master] Ladeziel-Synchronisierung: VIS-Slider wird auf ${obj.state.val}% gesetzt.`);
    setState(IDS.u_limit, obj.state.val, true);
});

// NEU: Manueller Start-Request Handler
on({ id: IDS.u_startChargeRequest, val: true, change: "any" }, () => {
    console.log("[EV3 Master] Manueller Start-Request via VIS/Button empfangen.");
    triggerStartSequence("VIS-Manuell");
    setTimeout(() => {
        setState(IDS.u_startChargeRequest, false, true);
    }, 1000);
});

// Täglicher Reset der Ladestatistik um 02:05 Uhr
schedule("5 2 * * *", () => {
  setState(IDS.u_timeDay, 0, true);
});

// Schutz der 12V-Starterbatterie des Kia
on({ id: IDS.bat12v, change: "ne" }, (obj) => {
  if (obj.state.val <= 50) ev3Notify(`⚠️ Kia 12V-Batterie kritisch!`, 5);
});
