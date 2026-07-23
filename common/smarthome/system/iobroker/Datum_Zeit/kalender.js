/* eslint-env es2022 */
/**
 * Name:   Kalender Datuminfo Pro (Fixed)
 * Zweck:  Erzeugt umfangreiche Datums- und Zeitinformationen für VIS
 */

// Wir definieren den Pfad sauber.
// "javascript." + instance erzeugt oft Dopplungen, daher nehmen wir den direkten Weg:
const path = `javascript.0.Kalender.Datuminfo.de`;
const logging = false;
const decimals = 1;

const monthLong = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const daysLong = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

// Hilfsfunktionen
const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const getQuarter = (date) => Math.floor(date.getMonth() / 3) + 1;
const getDayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

// Kalenderwoche nach ISO 8601 (robust)
function getKW(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const kw = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { num: kw, even: kw % 2 === 0 };
}

// Objekte anlegen mit createStateAsync
async function initObjects() {
  const states = [
    ["Jahr.Zahl", "number", "Kalender - Jahreszahl"],
    ["Jahr.Schaltjahr", "boolean", "Kalender - Schaltjahr"],
    ["Quartal.Nummer", "number", "Kalender - Quartal"],
    ["Quartal.gerade", "boolean", "Kalender - Quartal gerade"],
    ["Monat.Name.lang", "string", "Monatsname"],
    ["Monat.Nummer.Nummer", "number", "Monatsnummer"],
    ["Woche.Jahr.Kalenderwoche.Nummer", "number", "Kalenderwoche"],
    ["Tag.Woche.Nummer", "number", "Wochentag (Mo=1)"],
    ["Tag.Jahr.Vergangenheit.Anteil", "number", "Jahresfortschritt %", "%"],
    ["Datum.tagmonattext", "string", "Datum formatiert"],
  ];

  for (const [id, type, name, unit] of states) {
    /** @type {any} */
    const stateType = type;
    const defVal = type === "boolean" ? false : type === "number" ? 0 : "";
    await createStateAsync(`${path}.${id}`, defVal, {
      name: name,
      type: stateType,
      role: "value",
      read: true,
      write: false,
      unit: unit || "",
    });
  }
}

function updateDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  // Montag = 1, Sonntag = 7
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const leap = isLeapYear(year);
  const quarter = getQuarter(now);
  const kw = getKW(now);
  const dayYear = getDayOfYear(now);
  const daysInYear = leap ? 366 : 365;

  // Werte schreiben
  setState(`${path}.Jahr.Zahl`, year, true);
  setState(`${path}.Jahr.Schaltjahr`, leap, true);
  setState(`${path}.Quartal.Nummer`, quarter, true);
  setState(`${path}.Quartal.gerade`, quarter % 2 === 0, true);

  setState(`${path}.Monat.Name.lang`, monthLong[now.getMonth()], true);
  setState(`${path}.Monat.Nummer.Nummer`, month, true);

  setState(`${path}.Woche.Jahr.Kalenderwoche.Nummer`, kw.num, true);
  setState(`${path}.Tag.Woche.Nummer`, dayOfWeek, true);

  const yearShare = parseFloat(((dayYear * 100) / daysInYear).toFixed(decimals));
  setState(`${path}.Tag.Jahr.Vergangenheit.Anteil`, yearShare, true);

  const formatted = `${daysLong[now.getDay()]}, ${day}. ${monthLong[now.getMonth()]} ${year}`;
  setState(`${path}.Datum.tagmonattext`, formatted, true);

  if (logging) console.log(`Kalender-Info aktualisiert: ${formatted}`);
}

// Initialisierung
initObjects();
// Kurz warten, damit Objekte im System sind, dann erste Berechnung
setTimeout(updateDateInfo, 500);

// Schedule: Täglich um 00:00:05 Uhr
schedule("5 0 * * *", updateDateInfo);
