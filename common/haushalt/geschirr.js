/* eslint-env es2022 */
/**
 * Name:    Geschirrspüler-Überwachung
 * Purpose: Monitors dishwasher start (via miele-unbound) and program completion,
 *          calculating energy consumption, runtime, and sending notifications.
 */

// --- 1. KONFIGURATION (DATENPUNKTE & GERÄTEDATEN) ---
const DEVICE_ID = "000106831213";

const IDS = {
  // Miele Unbound (Lokale Status-Erkennung)
  inUse: `miele-unbound.0.${DEVICE_ID}.state.inUse`,
  estimatedEndTime: `miele-unbound.0.${DEVICE_ID}.estimatedEndTimeText`,

  // Energie- und Zählerdaten
  energyTotal: "alias.0.kueche.geschirr.ENERGY_Total",
  energyToday: "alias.0.kueche.geschirr.ENERGY_Today",
  strompreis: "0_userdata.0.Energie.Strompreise.akt_Preis",

  // Visualisierung & Status
  isSpuelenAktiv: "0_userdata.0.Haushalt.spuelen",
  programmRaw: "alias.0.kueche.geschirr.Programmbezeichnung_raw",
  programm: "alias.0.kueche.geschirr.Programmbezeichnung",
};

// Parameter für Benachrichtigungen & Zeiten
const DAY_START = "08:00";
const DAY_END = "20:00";
const START_NOTIFY_DELAY_MS = 10000; // 10 Sekunden Verzögerung vor Abruf der Endzeit

// Programm-Mapping (Rohwert -> Klartext)
const PROGRAMME = {
  0: "Aus",
  1: "Intensiv",
  2: "Maschinenpflege",
  3: "Eco",
  5: "SolarSpar",
  6: "Automatic",
  7: "Automatic",
  9: "Solarspar",
  10: "Schonen",
  11: "Extra leise",
  12: "Hygiene",
  13: "QuickPowerWash",
  14: "Pasta/Paella",
  17: "Große Teile",
  19: "Gläser warm",
  22: "Eco",
  26: "Intensiv",
  27: "Maschinenpflege",
  28: "Eco",
  30: "Normal",
  31: "Automatic",
  32: "Automatic",
  34: "Solarspar",
  35: "Schonen",
  36: "Extra leise",
  37: "Hygiene",
  38: "QuickPowerWash",
  42: "Große Teile",
  44: "PowerWash",
  200: "ECO",
  201: "Auto",
  202: "Automatic",
  203: "ComfortWash",
  204: "PowerWash",
  205: "Intensiv 75°C",
  206: "Hygiene 75°C",
  207: "ExtraLeise 50°C",
  208: "SolarSpar",
  209: "ComfortWash 55°C",
  210: "Fein 45°C",
  211: "Ohne Oberkorb 65°C",
  212: "Pasta / Paella",
  213: "Gläser",
  214: "Gerätepflege",
  215: "Salz spülen",
};

// --- 2. ZUSTANDSVARIABLEN ---
let strompreisProKWh = getState(IDS.strompreis)?.val || 0;
let startZeit = null;
let energieStart = null;
let startNotifyTimer = null;

// --- 3. EVENT-LISTENER & LOGIK ---

// Preis-Update bei Änderung des Strompreises
on({ id: IDS.strompreis, change: "ne" }, (obj) => {
  strompreisProKWh = obj.state.val;
});

// Programm-Dekodierung (Dynamisch)
on({ id: IDS.programmRaw, change: "any" }, (obj) => {
  const name = PROGRAMME[obj.state.val] || `Unbekannt (${obj.state.val})`;
  setState(IDS.programm, name, true);
});

// Hauptlogik Spülen (Start & Ende über miele-unbound inUse)
on({ id: IDS.inUse, change: "ne" }, (obj) => {
  const inUse = !!obj.state.val;
  const isSpuelenAktiv = !!getState(IDS.isSpuelenAktiv)?.val;

  // --- START ---
  if (inUse && !isSpuelenAktiv) {
    startZeit = Date.now();
    // Zählerstand beim Start erfassen
    energieStart = getState(IDS.energyTotal)?.val || 0;
    setState(IDS.isSpuelenAktiv, true, true);

    if (startNotifyTimer) clearTimeout(startNotifyTimer);
    startNotifyTimer = setTimeout(() => {
      const endTime = getState(IDS.estimatedEndTime)?.val;
      const vorhersage = `Der Geschirrspüler spült und ist voraussichtlich um ${endTime} fertig.`;

      const isDaytime = compareTime(DAY_START, DAY_END, "between");
      sendGlobalNotify(vorhersage, "Haushalt", 1, isDaytime ? 50 : null);
    }, START_NOTIFY_DELAY_MS);
  }

  // --- ENDE ---
  else if (!inUse && isSpuelenAktiv) {
    const spueldauerMin = startZeit ? Math.round((Date.now() - startZeit) / 60000) : 0;

    // Berechnung des Verbrauchs für DIESEN Durchgang
    const currentTotal = getState(IDS.energyTotal)?.val || 0;
    const energieKwh = energieStart !== null ? Math.max(0, currentTotal - energieStart) : 0;
    const euro = (energieKwh * strompreisProKWh).toFixed(2);

    const dauerStd = Math.floor(spueldauerMin / 60);
    const dauerMin = (spueldauerMin % 60).toString().padStart(2, "0");

    // Energie & Kosten für den heutigen Tag
    const energieHeute = getState(IDS.energyToday)?.val || 0;
    const euroHeute = (energieHeute * strompreisProKWh).toFixed(2);

    const programm = getState(IDS.programm)?.val || "Unbekannt";
    setState(IDS.isSpuelenAktiv, false, true);

    const meldetext =
      `<pre>💦 Der Geschirrspüler kann ausgeräumt werden.\n\n` +
      `Programm: ${programm}\n` +
      `Dauer: ${dauerStd}:${dauerMin} Std.\n` +
      `Verbrauch: ${energieKwh.toFixed(2)} kWh (${euro} €)\n` +
      `Heute gesamt: ${energieHeute.toFixed(2)} kWh (${euroHeute} €)\n` +
      `Preis/kWh: ${strompreisProKWh.toFixed(3)} €</pre>`;

    const isDaytime = compareTime(DAY_START, DAY_END, "between");
    sendGlobalNotify(
      meldetext,
      "Haushalt",
      1,
      isDaytime ? 50 : null,
      "Der Geschirrspüler kann ausgeräumt werden.",
    );
  }
});

// --- 4. LIFECYCLE CLEANUP ---
onStop((callback) => {
  if (startNotifyTimer) clearTimeout(startNotifyTimer);
  callback();
});
