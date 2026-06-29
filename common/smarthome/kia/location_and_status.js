/**
 * =============================================================================
 * SKRIPT: KIA MASTER-STEUERUNG (VERSION 2.11)
 * =============================================================================
 * ZWECK:
 * - Zentrales Management für Fahrzeug-Status (Sperrung, Klima, Laden).
 * - NEU: Automatische Erzeugung einer Google Maps Bild-URL für VIS.
 * - Schutz der 12V-Starterbatterie durch gezielte Abruf-Logik.
 * * DATENPUNKTE:
 * - Erzeugt automatisch alle benötigten Punkte unter 0_userdata.0.
 * =============================================================================
 */

// --- 1. BASIS-KONFIGURATION ---
// Hier definierst du die Pfade zu deinem Kia-Adapter und deinem Speicherort.
const VIN = "bluelink.0.KNAFD81A7S6058382";
const PATH_USER = "0_userdata.0.Energie.Kia_e_niro";

const IDS = {
  // Eingangs-Datenpunkte vom Bluelink-Adapter
  ctrlCharge: `${VIN}.control.charge`,
  ctrlChargeStop: `${VIN}.control.charge_stop`,
  ctrlClimaStart: `${VIN}.control.clima.start`,
  ctrlClimaStop: `${VIN}.control.clima.stop`,
  ctrlLock: `${VIN}.control.lock`,
  ctrlUnlock: `${VIN}.control.unlock`,
  refreshCar: `${VIN}.control.force_refresh_from_car`, // Weckt das Auto aktiv auf
  refreshSrv: `${VIN}.control.force_refresh_from_server`, // Holt nur den letzten Stand vom Server
  lat: `${VIN}.vehicleLocation.lat`,
  lon: `${VIN}.vehicleLocation.lon`,

  // Dein Google API-Token (muss in diesem Datenpunkt hinterlegt sein)
  googleToken: "0_userdata.0.google.mapsAPItoken",

  // Eigene Datenpunkte für die VIS-Oberfläche
  u_manualRefresh: `${PATH_USER}.Manual_Refresh_Location`,
  u_counter: `${PATH_USER}.Anz_Aktualisierung`,
  u_standort: `${PATH_USER}.Standort`,
  u_googleMapUrl: `${PATH_USER}.GoogleMapsStaticUrl`, // Der neue Punkt für das Kartenbild
  u_updateTime: `${PATH_USER}.Aktualisierung`,
  u_chargeState: `${PATH_USER}.charge`,
  u_klimaState: `${PATH_USER}.klima_status`,
  u_doorLock: `${PATH_USER}.doorlock`,
};

// Interne Variablen zur Steuerung
let lastLat = 0;
let lastLon = 0;
let isLocked = false; // Verhindert Mehrfach-Trigger innerhalb kurzer Zeit
let viewTriggerLock = 0; // Cooldown für das Aufwecken des Autos via VIS-View

// --- 2. INITIALISIERUNG DER DATENPUNKTE ---
// Diese Funktion prüft beim Start, ob alle Punkte vorhanden sind und legt sie ggf. an.
async function initKiaSystem() {
  const states = [
    {
      id: IDS.u_manualRefresh,
      type: "boolean",
      name: "Manuellen Standort-Refresh auslösen",
      role: "button",
    },
    { id: IDS.u_counter, type: "number", name: "Anzahl Aktualisierungen heute" },
    { id: IDS.u_standort, type: "string", name: "Aktueller Standort (Adresse)" },
    { id: IDS.u_googleMapUrl, type: "string", name: "Google Maps Static URL (Bild)" }, // Automatisches Anlegen
    { id: IDS.u_updateTime, type: "string", name: "Letzte Aktualisierung" },
    { id: IDS.u_chargeState, type: "boolean", name: "Ladestatus (aktiv/inaktiv)" },
    { id: IDS.u_klimaState, type: "boolean", name: "Klimatisierung (an/aus)" },
    { id: IDS.u_doorLock, type: "boolean", name: "Fahrzeug verriegelt" },
  ];

  for (const s of states) {
    if (!existsState(s.id)) {
      await createStateAsync(s.id, s.type === "number" ? 0 : s.type === "boolean" ? false : "", {
        type: s.type,
        name: s.name,
        role: s.role || "state",
      });
      console.log(`[Kia] Datenpunkt ${s.id} wurde neu angelegt.`);
    }
  }
}
initKiaSystem();

// --- 3. INTELLIGENTE VIEW-TRIGGER ---
// Reagiert darauf, wenn du in deiner VIS auf die Auto-Seite wechselst.
on({ id: /^vis\..*\.control\.data$/, change: "any" }, async (obj) => {
  if (!obj.state.val) return;
  const viewPath = obj.state.val;

  // Prüft, ob die Tablet- oder Smartphone-Ansicht für das Auto aufgerufen wurde
  if (viewPath === "projektx/960_Auto" || viewPath === "projektx_sp/963_Standort_eNiro") {
    const now = Date.now();
    // 10 Minuten Cooldown, damit ständiges Hin- und Her-Zappen die 12V Batterie nicht leert
    if (now > viewTriggerLock) {
      console.warn(`[Kia] Gezielte Fahrzeug-Abfrage durch View-Aufruf: ${viewPath}`);
      setState(IDS.refreshCar, true);
      viewTriggerLock = now + 600000;
    }
  }
});

// --- 4. MANUELLER REFRESH-BUTTON ---
on({ id: IDS.u_manualRefresh, val: true, change: "any" }, () => {
  console.warn("[Kia] Manueller Standort-Refresh via VIS ausgelöst.");
  setState(IDS.refreshCar, true);
  setTimeout(() => {
    setState(IDS.u_manualRefresh, false, true);
  }, 500);
});

// --- 5. AUTOMATISCHE ZEITPLÄNE ---
// Stündliche Abfrage vom SERVER (schont die Autobatterie)
schedule("58 6-20 * * *", () => {
  setState(IDS.refreshSrv, true);
});

// Zähler für tägliche Abfragen um Mitternacht zurücksetzen
schedule("0 0 * * *", () => {
  setState(IDS.u_counter, 0, true);
});

// --- 6. STANDORT- & KARTEN-LOGIK ---
// Diese Funktion wird aufgerufen, wenn neue Standortdaten vorliegen.
on(
  { id: [IDS.refreshCar, IDS.refreshSrv, `${VIN}.control.force_refresh`], change: "any" },
  async (obj) => {
    if (obj.state.val !== true) return;

    // Zeitstempel und Zähler aktualisieren
    setState(IDS.u_counter, (getState(IDS.u_counter)?.val || 0) + 1, true);
    setState(IDS.u_updateTime, formatDate(new Date(), "hh:mm"), true);

    processLocationUpdate();
  },
);

async function processLocationUpdate() {
  if (isLocked) return; // Verhindert doppelte Ausführung
  activateLock(30000); // 30 Sekunden Sperre für diesen Prozess

  const lat = getState(IDS.lat)?.val;
  const lon = getState(IDS.lon)?.val;
  const apiKey = getState(IDS.googleToken)?.val;

  if (!lat || !lon || !apiKey) {
    console.error("[Kia] Abbruch: Koordinaten oder Google-Key fehlen.");
    return;
  }

  // --- KARTEN-URL BAUEN ---
  // Wir erstellen ein statisches Bild mit einem roten Marker auf der Auto-Position.
  const zoom = 15; // 0 (Welt) bis 21 (Hausnummer)
  const size = "470x365"; // Größe des Bildes für deine VIS
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=${zoom}&size=${size}&maptype=roadmap&markers=color:red%7C${lat},${lon}&key=${apiKey}`;

  // Den neuen Link in den Datenpunkt schreiben
  setState(IDS.u_googleMapUrl, staticMapUrl, true);

  // --- ADRESS-GEOCODING (TEXT) ---
  // Die Adresse wird nur aktualisiert, wenn sich die Koordinaten nennenswert geändert haben.
  if (lat.toFixed(4) === lastLat.toFixed(4) && lon.toFixed(4) === lastLon.toFixed(4)) {
    return;
  }

  const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;

  httpGet(geoUrl, (err, response) => {
    if (err || !response || !response.data) return;
    try {
      const data = JSON.parse(response.data);
      if (data.results?.[0]) {
        const address = data.results[0].formatted_address;
        lastLat = lat;
        lastLon = lon;
        setState(IDS.u_standort, address, true);
        console.log(`[Kia] Neuer Standort erkannt: ${address}`);
      }
    } catch (e) {
      console.error("[Kia] Fehler beim Geocoding: " + e);
    }
  });
}

// --- 7. STATUS-SPIEGELUNG (Laden, Klima, Verriegelung) ---
on(
  {
    id: [
      IDS.ctrlCharge,
      IDS.ctrlChargeStop,
      IDS.ctrlClimaStart,
      IDS.ctrlClimaStop,
      IDS.ctrlLock,
      IDS.ctrlUnlock,
    ],
    change: "any",
  },
  (obj) => {
    if (!obj.state.val) return;
    const id = obj.id;

    if (id.includes("charge")) {
      setState(IDS.u_chargeState, !id.includes("charge_stop"), true);
    } else if (id.includes("clima")) {
      setState(IDS.u_klimaState, !id.includes("stop"), true);
    } else if (id.includes("lock")) {
      setState(IDS.u_doorLock, !id.includes("unlock"), true);
    }
  },
);

/**
 * Hilfsfunktion zur Verriegelung von Triggern
 * @param {number} ms - Zeit in Millisekunden
 */
function activateLock(ms) {
  isLocked = true;
  setTimeout(() => {
    isLocked = false;
  }, ms);
}
