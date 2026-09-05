/* eslint-env es2022 */
/**
 * =============================================================================
 * UNIVERSAL MASTER v3.0 - THE ENERGY GUARDIAN
 * =============================================================================
 * ZWECK: Zentrale Steuerung von PV, Batterie, Sauna und Wallbox.
 * RECHENKERN: Physikalische Berechnung von Hausverbrauch und Autarkie.
 * SCHUTZLOGIKEN:
 * 1. Sauna-Priorisierung: Schützt die Batterie vor Hochstrom-Entladung.
 * 2. Anti-Zappel: Verhindert Min-SoC-Sprünge bei taktendem Saunaofen.
 * 3. Smart-Notify: Unterdrückt Telegram-Spam während der Wellness-Phase.
 * 4. Watchdog: Überwacht Änderungen des Min-SoC am Wechselrichter.
 * 5. Safety-Guard: Warnt, wenn die Sauna bei offener Tür heizt.
 * 6. Datenpunkte Restladezeit und Ladung_final_Uhrzeit glattgezogen
 * 7. Waschmaschine und Trockner weg vom alias
 * =============================================================================
 */

// --- 1. KONFIGURATION (PFADE & ADRESSEN) ---
const PATH_PV = "0_userdata.0.Energie.PV.";
const PATH_SAUNA = "0_userdata.0.Haushalt.";
const PATH_SAUNA_DATA = "0_userdata.0.Energie.Sauna.";

const IDS = {
  // Hardware-Eingänge (Wechselrichter & Zähler)
  pvPower: "solax.0.data.acpower", // Aktuelle Erzeugung (W)
  pvYield: "solax.0.data.yieldtoday", // Tagesertrag (kWh)
  netPower: "smartmeter.0.1-0:16_7_0__255.value", // Hausanschluss (+Bezug / -Einspeisung)
  batPower: "modbus.0.inputRegisters.100.842_Battery_Power_(System)", // Batterie (+Laden / -Entladen)
  batSoc: "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)", // SoC (%)

  // Konfiguration & Steuerung
  speicherMax: "0_userdata.0.Energie.PV.Speichergroesse", // Kapazität in kWh (z.B. 9.6)
  saunaLogik: `${PATH_SAUNA}sauna_laeuft`, // Status-Flag für die Priorisierung
  saunaTuer: "alias.0.sauna.tuer.opened", // Türkontakt
  minSocSet: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)", // Schreiben
  minSocRead: "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)", // Lesen

  // Harvia Fenix Integration (native adapter datapoints)
  saunaHeatOn: "harvia-fenix.0.heatOn",
  saunaHeaterPower: "harvia-fenix.0.heaterPower",
  saunaDoorSafety: "harvia-fenix.0.doorSafety",

  // Wallbox-Integration
  wbStatus: "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.1.status",
  wbLimit:
    "ocpp.0.http://192_168_178_80:9220/EVB-P21312507.configuration.evb_MaximumStationCurrent",
};
const DP_MINSOC_BACKUP = `${PATH_PV}Sauna_MinSoc_Backup`;

// Interne Speicher für Berechnungen
let pvP = 0,
  netP = 0,
  batP = 0,
  soc = 0,
  sMax = 0;
let tVerbrauchWh = 0,
  tLadungWh = 0,
  tNetzWh = 0,
  lastTs = Date.now();
let originalMinSoc = null,
  tSaunaStart = null,
  tSaunaReset = null;
let tSaunaSafety = null;

// --- 2. INITIALISIERUNG (SYSTEMSTART) ---
async function initSystem() {
  // Erzeugt alle nötigen Datenpunkte für die Visualisierung (VIS)
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
    { id: DP_MINSOC_BACKUP, unit: "%", type: "number" },
    { id: `${PATH_SAUNA_DATA}sauna_heizt_aktiv`, unit: "", type: "boolean" },
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
  // Werte laden, damit Zähler nach Skript-Neustart weiterlaufen
  sMax = parseFloat(getState(IDS.speicherMax)?.val) || 9.6;

  // LIVE-WERTE INITIALISIEREN (Fix für falsche Berechnung nach Neustart)
  pvP = getState(IDS.pvPower)?.val || 0;
  netP = getState(IDS.netPower)?.val || 0;
  batP = getState(IDS.batPower)?.val || 0;
  soc = getState(IDS.batSoc)?.val || 0;

  // Sicherer Abruf des Backups (verhindert Warnungen bei Erststart)
  if (existsState(DP_MINSOC_BACKUP)) {
    originalMinSoc = getState(DP_MINSOC_BACKUP)?.val || null;
  }

  tVerbrauchWh = getState(`${PATH_PV}Tagesverbrauch`)?.val || 0;
  tLadungWh = getState(`${PATH_PV}Tagesladung`)?.val || 0;
  tNetzWh = getState(`${PATH_PV}TagesNetzbezug`)?.val || 0;

  console.log(`Master v3.0 gestartet. Speicher: ${sMax} kWh, SoC: ${soc}%, BatPower: ${batP}W`);
  runUpdate(); // Sofortiger Update-Lauf
}
initSystem();

// --- 3. HILFSFUNKTIONEN ---

/**
 * Berechnet die Last im Haus abzüglich bekannter Großverbraucher.
 * Nötig, um den Saunaofen (taktet) von anderen Lasten zu unterscheiden.
 * HINWEIS: Für eine bessere Performance wäre es optimal, für die gP-Geräte
 * 'on'-Trigger zu verwenden, anstatt 'getState' wiederholt aufzurufen.
 */
function getBereinigteLast() {
  const hausV = Number(getState(`${PATH_PV}Hausverbrauch`)?.val) || 0;
  let abzug = 0;
  const gP = [
    "alias.0.kueche.boiler.ENERGY_Power",
    "alias.0.kueche.geschirr.ENERGY_Power",
    "sonoff.0.Waschmaschine.ENERGY_Power",
    "sonoff.0.Trockner.ENERGY_Power",
    "alias.0.kueche.backofen.ENERGY_Power",
  ];

  // Summiere alle eingeschalteten Zwischenstecker
  gP.forEach((id) => {
    const val = getState(id)?.val;
    if (val) abzug += Number(val);
  });

  // Wallbox-Anteil berechnen: (Limit / 10) * 230V * 3 Phasen
  if (getState(IDS.wbStatus)?.val === "Charging") {
    const lim = Number(getState(IDS.wbLimit)?.val) || 60;
    abzug += (lim / 10) * 230 * 3;
  }
  return hausV - abzug;
}

// --- 4. HAUPT-ENGINE (PHYSICAL CALCULATION) ---

function runUpdate() {
  const now = Date.now();
  const diff = now - lastTs;
  if (diff < 100) return; // Verhindert unnötige Rechenlast

  // Grundformel: Hausverbrauch = PV + Netz - Batterie
  // (Batterie negativ bei Ladung, daher passt das Vorzeichen automatisch)
  let curHausV = pvP + netP - batP;
  if (curHausV < 0) curHausV = 0;

  // Zeit-Integration für Wh-Zähler
  const h = diff / 3600000;
  tVerbrauchWh += curHausV * h;
  if (batP > 0) tLadungWh += batP * h; // Nur echte Ladung zählen (Ladeleistung ist positiv)
  if (netP > 0) tNetzWh += netP * h;
  lastTs = now;

  // Batterie-Metriken (Wie lange dauert das Laden noch?)
  const curKwh = (sMax * soc) / 100;
  let ladeEndeUhrzeit = "n.v.",
    ladeDauerAnzeige = "---";

  // Berechnung der Restladezeit, wenn die Batterie geladen wird (positive Leistung)
  if (batP > 50) {
    const ladeLeistungKW = batP / 1000;
    const fehlendeKwh = sMax - curKwh;

    // Sicherstellen, dass Werte für die Berechnung gültig sind
    if (ladeLeistungKW > 0 && fehlendeKwh > 0) {
      const restStunden = fehlendeKwh / ladeLeistungKW;
      const restSekunden = restStunden * 3600;

      const stunden = Math.floor(restStunden);
      const minuten = Math.floor((restStunden * 60) % 60);
      ladeDauerAnzeige = `${stunden < 10 ? `0${stunden}` : stunden}:${minuten < 10 ? `0${minuten}` : minuten}`;

      const endeDatum = new Date();
      endeDatum.setSeconds(endeDatum.getSeconds() + restSekunden);
      ladeEndeUhrzeit = formatDate(endeDatum, "hh:mm");
    }
  }

  // Autarkie-Berechnung (Was kommt nicht aus dem Netz?)
  const aut =
    curHausV > 0 ? Math.round(Math.min(100, (1 - Math.max(0, netP) / curHausV) * 100)) : 0;

  // Datenpunkte für Dashboard schreiben
  setState(`${PATH_PV}Hausverbrauch`, Math.round(curHausV), true);
  setState(`${PATH_PV}Netzbezug`, Math.max(0, Math.round(netP)), true);
  setState(`${PATH_PV}Einspeisung`, Math.abs(Math.min(0, Math.round(netP))), true);
  setState(`${PATH_PV}Autarkie`, aut, true);
  setState(`${PATH_PV}lade_kwh`, parseFloat(curKwh.toFixed(1)), true);
  setState(`${PATH_PV}Restladezeit`, ladeDauerAnzeige, true);
  setState(`${PATH_PV}Ladung_final_Uhrzeit`, ladeEndeUhrzeit, true);

  // Sommer-Strategie (Flag für VIS)
  const d = new Date();
  const sommer = d.getMonth() >= 3 && d.getMonth() <= 8 && d.getHours() >= 14 && soc >= 85;
  setState(`${PATH_PV}Wallbox_Freigabe`, sommer, true);

  // --- SAUNA-LOGIK MIT ANTI-ZAPPEL-SYSTEM (HYBRID HARVIA-FENIX INTEGRATION) ---
  const bLast = getBereinigteLast();

  // Explicit status from Harvia Fenix adapter
  const fenixHeatOn = getState(IDS.saunaHeatOn)?.val === true;
  const fenixPower = Number(getState(IDS.saunaHeaterPower)?.val) || 0;

  // ECHTZEIT-STATUS: Zieht der Ofen gerade physikalisch Strom?
  const saunaIsHeating = fenixHeatOn && (fenixPower > 0 || bLast > 5000);
  setState(`${PATH_SAUNA_DATA}sauna_heizt_aktiv`, saunaIsHeating, true);

  // Sicherheits-Check: Heizt die Sauna bei offener Tür?
  checkSaunaSafety(fenixHeatOn, bLast);

  const sL = getState(IDS.saunaLogik)?.val;

  if (fenixHeatOn) {
    // Harvia controller is active
    if (tSaunaReset) {
      clearTimeout(tSaunaReset);
      tSaunaReset = null;
    }

    if (!sL && !tSaunaStart) {
      startSauna();
    } else if (sL && soc > getState(IDS.minSocRead)?.val) {
      // Während der Sauna: Min-SoC kontinuierlich dem SoC folgen lassen
      setState(IDS.minSocSet, soc);
    }
  } else if (!fenixHeatOn && sL) {
    // Harvia controller is off
    if (!tSaunaReset) {
      stopSauna();
    }
  }
}

// --- 5. SAUNA AKTIONEN ---

function startSauna() {
  setState(IDS.saunaLogik, true, true);
  originalMinSoc = getState(IDS.minSocRead)?.val; // Ursprungswert merken (z.B. 40%)
  setState(DP_MINSOC_BACKUP, originalMinSoc, true); // Persistent speichern
  setState(IDS.minSocSet, soc); // Batterie sofort auf aktuellem Level sperren
  console.log(`Sauna: Priorisierung AKTIV, Min-SoC auf ${soc}% fixiert`);
}

function stopSauna() {
  // Wir warten 35 Minuten (2.100.000 ms) ob noch einmal Last kommt
  tSaunaReset = setTimeout(() => {
    if (originalMinSoc !== null) {
      setState(IDS.minSocSet, originalMinSoc); // Zurück auf Normalwert
      setState(DP_MINSOC_BACKUP, 0, true); // Backup leeren
      console.log("Sauna: Nachlauf abgelaufen, Batterie wieder freigegeben");
    }
    setState(IDS.saunaLogik, false, true);
    tSaunaReset = null;
  }, 2100000);
}

// --- 6. TRIGGER & WATCHDOGS ---

// Sensordaten-Trigger
on({ id: IDS.pvPower, change: "ne" }, (obj) => {
  pvP = obj.state.val || 0;
  runUpdate();
});
on({ id: IDS.netPower, change: "ne" }, (obj) => {
  netP = obj.state.val || 0;
  runUpdate();
});
on({ id: IDS.batPower, change: "ne" }, (obj) => {
  batP = obj.state.val || 0;
  runUpdate();
});
on({ id: IDS.batSoc, change: "ne" }, (obj) => {
  soc = obj.state.val || 0;
  runUpdate();
});

// Direct event trigger for Harvia Fenix heatOn state
on({ id: IDS.saunaHeatOn, change: "ne" }, (obj) => {
  if (obj.state.val === true) {
    if (tSaunaReset) {
      clearTimeout(tSaunaReset);
      tSaunaReset = null;
    }
    if (!getState(IDS.saunaLogik)?.val) {
      startSauna();
    }
  } else {
    if (getState(IDS.saunaLogik)?.val && !tSaunaReset) {
      stopSauna();
    }
  }
  runUpdate();
});

// Trigger für Speichergröße-Änderung (falls in Objekten angepasst)
on({ id: IDS.speicherMax, change: "ne" }, (obj) => {
  sMax = parseFloat(obj.state.val) || 9.6;
  runUpdate();
});

// Trigger bei Änderung des Wallbox-Stromlimits (z.B. Umschaltung 6A <-> 16A)
on({ id: IDS.wbLimit, change: "ne" }, () => {
  runUpdate();
});

// INTEGRIERTER MIN-SOC WATCHDOG (Telegram-Steuerung)
on({ id: IDS.minSocRead, change: "ne" }, (obj) => {
  const newVal = obj.state.val;
  const oldVal = obj.oldState ? obj.oldState.val : 0;
  if (newVal === oldVal) return;

  const text = `Min-SoC Update: Die Hausbatterie wurde auf ${newVal}% geregelt`;

  // SPAM-SCHUTZ: Während der Sauna nur loggen, kein Telegram senden
  if (getState(IDS.saunaLogik)?.val === true) {
    console.log(`Min-SoC Watchdog: Sauna-Modus aktiv, Änderung auf ${newVal}% wird ignoriert`);
  } else {
    sendGlobalNotify(text, "Energiemaster", 1);
    console.warn(`Min-SoC Watchdog: ${text}`);
  }
});

// Intervall für Tages-Statistiken (alle 10 Sek.)
setInterval(() => {
  const yieldWh = (getState(IDS.pvYield)?.val || 0) * 1000;
  setState(`${PATH_PV}Tageserzeugung`, Math.round(yieldWh), true);
  setState(`${PATH_PV}Tagesverbrauch`, Math.round(tVerbrauchWh), true);
  setState(`${PATH_PV}Tagesladung`, Math.round(tLadungWh), true);
  setState(`${PATH_PV}TagesNetzbezug`, Math.round(tNetzWh), true);
}, 10000);

// Mitternachts-Reset
schedule("0 0 * * *", () => {
  tVerbrauchWh = 0;
  tLadungWh = 0;
  tNetzWh = 0;
});

// --- 7. SAUNA SAFETY (TÜR-WÄCHTER) ---

/**
 * Prüft, ob ein gefährlicher Zustand vorliegt:
 * Tür ist offen UND die Harvia-Heizung ist aktiv.
 * @param {boolean} fenixHeatOn - Ob die Harvia Fenix Heizung aktiv ist.
 * @param {number} load - Die aktuelle bereinigte Hauslast in Watt.
 */
function checkSaunaSafety(fenixHeatOn, load) {
  const doorOpen = getState(IDS.saunaTuer)?.val || getState(IDS.saunaDoorSafety)?.val === false;
  const isHeating = fenixHeatOn && load > 5000;

  if (doorOpen && isHeating) {
    if (!tSaunaSafety) {
      tSaunaSafety = setTimeout(() => {
        // Erneute Prüfung nach Ablauf der Zeit
        const currentHeatOn = getState(IDS.saunaHeatOn)?.val === true;
        const currentDoorOpen =
          getState(IDS.saunaTuer)?.val || getState(IDS.saunaDoorSafety)?.val === false;
        if (currentDoorOpen && currentHeatOn && getBereinigteLast() > 5000) {
          sendGlobalNotify(
            "Achtung: Die Sauna heizt bei offener Tür, bitte überprüfen",
            "Energiemaster",
            8,
            70,
          );
        }
        tSaunaSafety = null;
      }, 60000); // Warnung nach 1 Minute Dauer-Heizen bei offener Tür
    }
  } else if (tSaunaSafety) {
    // Entwarnung: Tür zu oder Heizung aus
    clearTimeout(tSaunaSafety);
    tSaunaSafety = null;
  }
}

// Trigger für sofortige Prüfung bei Türbewegung
on({ id: IDS.saunaTuer, change: "ne" }, () => {
  const heatOn = getState(IDS.saunaHeatOn)?.val === true;
  checkSaunaSafety(heatOn, getBereinigteLast());
});
