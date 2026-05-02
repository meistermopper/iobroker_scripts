/**
 * =============================================================================
 * SKRIPT: EV3 LADE-MASTER v6.4.4
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
  remTime: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.Charging.RemainTime`, // [7] Restzeit in Min.
  targetSocSrv: `${VIN}.vehicleStatusRaw.Green.ChargingInformation.TargetSoC.Standard`, // [23] Ladeziel vom Fahrzeug
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
  u_auto: `${PATH_USER}.autoladen`, // [14] Schalter: PV-Automatik an/aus
  u_limit: `${PATH_USER}.Ladeprozent`, // [15] Ziel-SOC Slider
  u_smooth: `${PATH_USER}.Glaettung_Zeit`, // [16] EMA-Trägheit Slider
  u_power: `${PATH_USER}.Ladeleistung`, // [17] Anzeige Watt (fest 3690W)
  u_timeDay: `${PATH_USER}.Ladezeit`, // [18] Lademinuten heute
  u_rest: `${PATH_USER}.Restladezeit`, // [19] HH:MM Anzeige
  aliasKm: "alias.0.umrechnen.kia_ladekm", // [20] gewonnene Reichweite
  aliasDur: "alias.0.umrechnen.kia_ladezeit", // [21] Zeit-Objekt
  u_startChargeRequest: `${PATH_USER}.Start_Charge_Request`, // [NEW] Request to start charging
};

// --- PARAMETER ---
const PV_START_LIMIT = 4600; // Startschwelle (Sonne muss > 4,6kW + Puffer liefern)
const PV_STOP_LIMIT = 4000;  // Stoppschwelle (Ladevorgang pausieren, wenn Überschuss sinkt)
const FIXED_CHARGE_W = 3960; // Fixe Leistung bei 6A (220V * 3 Phasen * 6A)
const GOTIFY_TOKEN = getState("0_userdata.0.gotifytoken.iobroker").val;

let startZeitLaden = null; // Merker für Statistik
let originalMinSoc = null; // Merker für Min-SoC bei manuellem Laden
let stopTimer = null;      // Timer zur Entprellung von kurzen Lade-Unterbrechungen
let reconnectTimer = null; // Timer für Wallbox-Recovery
let wasOfflineReported = false; // Status für Anti-Spam Meldungen

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

  //console.log(
  //  "[EV3 Master] v6.3.1 Initialisierung abgeschlossen. Manuelles Laden schützt jetzt den Haus-Akku",
  //  "[EV3 Master] v6.4.3 Initialisierung abgeschlossen. Diagnose-Logging aktiviert.",
  //);
}
initLadeSystem();

// --- 3. KOMMUNIKATION ---

function ev3Notify(text, prio = 1, spoken = null) {
  sendTo("telegram", "send", { text: text });
  exec(
    `curl "https://mygotify.meistermopper.de/message?token=${GOTIFY_TOKEN}" -F "title=EV3 Master" -F "message=${text}" -F "priority=${prio}"`,
  );

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
schedule("* * * * *", () => {
  const current = Number(getState(IDS.pvPower).val) || 0;
  const oldAvg = Number(getState(IDS.pvAverage).val) || current;
  const inertia = Number(getState(IDS.u_smooth).val) || 10;
  let alpha = current < oldAvg ? 0.5 : 1 / inertia;
  const newAvg = alpha * current + (1 - alpha) * oldAvg;
  setState(IDS.pvAverage, Math.round(newAvg), true);
});

// --- 5. AUTOMATIONS-LOGIK (PV-ÜBERSCHUSS) ---

/**
 * Überwacht den PV-Durchschnitt und schaltet die Ladung automatisch,
 * sofern der Automatik-Schalter in der VIS aktiv ist.
 */
function checkPvAutomation() {
  const isAuto = getState(IDS.u_auto).val;
  const mittel = getState(IDS.pvAverage).val;

  // Abbrechen, wenn Wallbox offline ist
  const isConnected = getState(IDS.wbConn).val;
  if (!isConnected && mittel > PV_START_LIMIT) console.warn("[EV3 Master] Start wegen fehlender WB-Verbindung (OCPP Offline) nicht möglich.");
  if (!isAuto || !isConnected) return;

  const isTransActive = getState(IDS.wbTrans).val;
  const batSoc = getState(IDS.batSocPV).val;
  const wbStatus = getState(IDS.wbStat).val;

  // Fahrzeug-SOC und Ladeziele (VIS vs. Auto-Einstellung)
  const evSoc = getState(IDS.soc).val || 0;
  const limitVis = getState(IDS.u_limit).val || 100;
  const limitCar = getState(IDS.targetSocSrv).val || 100;

  // Diagnose-Log bei ausreichendem Überschuss, falls nicht geladen wird
  if (!isTransActive && mittel > PV_START_LIMIT) {
      console.log(`[EV3 Master] Prüfe Startbedingungen: Auto-Mode=${getState(IDS.u_auto).val}, WB-Conn=${getState(IDS.wbConn).val}, PV-Avg=${mittel}W, Bat=${batSoc}%, EV-SoC=${evSoc}%, Lim-VIS=${limitVis}%, Lim-Car=${limitCar}%, Status=${wbStatus}`);
  }

  // START: Genügend Sonne (>4,6kW) und Hausspeicher gut gefüllt (>75%)
  if (!isTransActive && mittel > PV_START_LIMIT && batSoc > 75 && evSoc < limitVis && evSoc < limitCar) {
    // Erlaubte Status für Start: Fahrzeug eingesteckt (Preparing), Pausiert (Suspended) oder gerade beendet (Finishing)
    // 'Available' wird ignoriert, da dort kein Stecker steckt.
    const readyToStart = ["Preparing", "Finishing", "SuspendedEVSE", "SuspendedEV"].includes(wbStatus);

    if (readyToStart) {
      setState(IDS.wbTrans, true);
      ev3Notify("🔋 Das Überschussladen des EV 3 wurde mit 6 Ampere aktiviert");
      // NEU: Wallbox-Reset/Re-Authorize via Availability vor Start (behebt OCPP-Hänger)
      setState(IDS.wbAvail, "Inoperative");

      setTimeout(() => {
          setState(IDS.wbAvail, "Operative");
          setTimeout(() => {
              setState(IDS.wbTrans, true);
              ev3Notify("🔋 Das Überschussladen des EV 3 wurde nach Wallbox-Reset aktiviert");
          }, 2000);
      }, 1000);
    } else {
        if (wbStatus === "Available") {
            console.warn("[EV3 Master] Start verhindert: Wallbox meldet 'Available' (kein Fahrzeug erkannt)");
        }
    }
  }
  // STOP: Überschuss sinkt unter die Ladeleistung (Pausierung)
  else if (isTransActive && (mittel < PV_STOP_LIMIT || evSoc >= limitVis || evSoc >= limitCar)) {
    setState(IDS.wbTrans, false);
    ev3Notify("Das Laden des EV 3 wurde beendet");
  }
}

// Trigger bei neuen PV-Werten sowie bei Wiederherstellung der Verbindung
on({ id: IDS.pvAverage, change: "ne" }, checkPvAutomation);
on({ id: IDS.soc, change: "ne" }, checkPvAutomation);
on({ id: IDS.wbConn, val: true, change: "ne" }, checkPvAutomation);

// --- 6. MONITORING & STATISTIK ---

/**
 * Erfasst Ladedauer und setzt die Leistungsanzeige.
 * Erfasst Ladedauer, setzt die Leistungsanzeige und schützt bei manuellem
 * Laden die Hausbatterie vor Entladung.
 */
on({ id: IDS.wbStat, change: "ne" }, (obj) => {
  const status = obj.state.val;
  const isAuto = getState(IDS.u_auto).val;

  if (status === "Charging") {
    // Falls ein Stop-Timer läuft: Abbrechen, da es nur ein kurzer Schluckauf war
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
      console.log("[EV3 Master] Kurze Unterbrechung beendet, lade weiter...");
      return;
    }

    if (!startZeitLaden) startZeitLaden = Date.now();
    // Da die Box starr 6A lädt, setzen wir den festen Watt-Wert
    setState(IDS.u_power, FIXED_CHARGE_W, true);

    // NEU: Batterieschutz bei manuellem Laden (Automatik AUS)
    if (!isAuto && originalMinSoc === null) {
      originalMinSoc = getState(IDS.minSocRead).val;
      const currentBatSoc = getState(IDS.batSocPV).val;
      setState(IDS.minSocSet, currentBatSoc);
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
        setState(IDS.minSocSet, originalMinSoc);
        const msg = `Manuelles Laden beendet. Haus-Akku auf ${originalMinSoc}% freigegeben.`;
        console.log(`[EV3 Master] ${msg}`);
        ev3Notify(`🔌 ${msg}`);
        originalMinSoc = null; // Merker zurücksetzen
      }

      // 1. Dauer des aktuellen Ladevorgangs in Minuten berechnen
      let dauerMin = Math.round((Date.now() - startZeitLaden) / 60000);

      // 2. Gesamtdauer für heute ermitteln (Bisherige Zeit + Aktuelle Zeit)
      let totalMin = (getState(IDS.u_timeDay).val || 0) + dauerMin;
      setState(IDS.u_timeDay, totalMin, true);

      setTimeout(() => {
        // 3. Optimierung der Sprachausgabe (SayIt)
        let h = Math.floor(totalMin / 60); // Ganze Stunden
        let m = totalMin % 60;             // Verbleibende Minuten

        let formattedTime = h > 0 ? `${h}:${m < 10 ? "0" + m : m} Std` : `${m} Minuten`;

        // Kilometer-Berechnung (81.4 kWh Kapazität)
        const energyKWh = (totalMin / 60) * (FIXED_CHARGE_W / 1000);
        const month = new Date().getMonth();
        const rangeMax = (month >= 3 && month <= 10) ? 550 : 450; // April-Okt: 550km, Okt-April: 450km
        const kmToday = Math.round((energyKWh / 81.4) * rangeMax);

        let spokenTime =
          h > 0 ? `${h} Stunde${h === 1 ? "" : "n"} und ${m} Minuten` : `${m} Minuten`;

        // 4. Benachrichtigung senden
        ev3Notify(
          `❌ Ladung beendet. Heute geladen: ${formattedTime} (+ca. ${kmToday} km)`,
          1,
          `Ladung beendet. Heute geladen: ${spokenTime}. Das entspricht etwa ${kmToday} Kilometern Reichweite.`,
        );
      }, 2000);

      startZeitLaden = null;
      setState(IDS.u_power, 0, true);
      stopTimer = null;
    }, 45000); // 45 Sekunden Pufferzeit
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
      console.warn("[EV3 Master] Wallbox-Verbindung verloren. Reconnect-Timer (3 Min) gestartet.");
      wasOfflineReported = true;
    }
    // Reconnect-Timer starten (falls nicht schon einer läuft)
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        console.log("[EV3 Master] Führe WiFi-Reconnect der Wallbox via UniFi Accesspoint aus...");
        setState(IDS.unifiReconnect, true);
        reconnectTimer = null;
      }, 180000); // 3 Minuten
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

// NEU: Manueller Start-Request Handler
on({ id: IDS.u_startChargeRequest, val: true, change: "any" }, () => {
    console.log("[EV3 Master] Manueller Start-Request via VIS/Button empfangen.");
    setState(IDS.wbTrans, true);
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
