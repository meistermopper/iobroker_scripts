/* eslint-env es2022 */
/**
 * Name:   Astro- & Zeitberechnungen
 * Zweck:  Berechnung von Tageslänge, Nachtlänge und Fortschritt für VIS
 */

// --- KONFIGURATION DER PFADE ---
const BASE_PATH = "javascript.0.zeiten.";
const USER_DATA_PATH = "0_userdata.0.Zeiten.";

// Hilfsfunktion zum sauberen Formatieren von HH:mm
const formatTime = (date) => formatDate(date, "hh:mm");

// --- 1. SONNENAUF- & UNTERGANG (Alle 5 Min nach der vollen Stunde) ---
schedule("5 * * * *", () => {
  const sunrise = getAstroDate("sunrise");
  const sunset = getAstroDate("sunset");

  setState(`${BASE_PATH}sonnenaufgang`, formatTime(sunrise), true);
  setState(`${BASE_PATH}sonnenaufgang_stunde`, sunrise.getHours().toString(), true);
  setState(`${BASE_PATH}sonnenaufgang_minute`, sunrise.getMinutes().toString(), true);
  setState(`${BASE_PATH}sonnenuntergang`, formatTime(sunset), true);
});

// --- 2. TAGES- & NACHTLÄNGE (Täglich um 00:05 Uhr) ---
schedule("5 0 * * *", async () => {
  const sunrise = getAstroDate("sunrise");
  const sunset = getAstroDate("sunset");

  // Tageslänge berechnen
  const tageslaengeMin = Math.floor((sunset - sunrise) / 60000);
  const std = Math.floor(tageslaengeMin / 60)
    .toString()
    .padStart(2, "0");
  const min = (tageslaengeMin % 60).toString().padStart(2, "0");

  // Werte speichern
  const gesternMin = getState(`${BASE_PATH}tageslaenge_in_minuten`)?.val;
  setState(`${BASE_PATH}tageslaenge_in_minuten_gestern`, String(gesternMin), true);
  setState(`${BASE_PATH}tageslaenge_in_minuten`, String(tageslaengeMin), true);
  setState(`${BASE_PATH}tageslaenge`, `${std}:${min}`, true);

  // Nachtlänge berechnen
  const nachtlaengeMin = 1440 - tageslaengeMin;
  const nStd = Math.floor(nachtlaengeMin / 60)
    .toString()
    .padStart(2, "0");
  const nMin = (nachtlaengeMin % 60).toString().padStart(2, "0");
  setState(`${BASE_PATH}nachtlaenge_in_minuten`, String(nachtlaengeMin), true);
  setState(`${BASE_PATH}nachtlaenge`, `${nStd}:${nMin}`, true);

  // Differenz berechnen (nach kurzem Timeout für DB-Sync)
  setTimeout(() => {
    const diff = tageslaengeMin - gesternMin;
    setState(`${BASE_PATH}tageslaenge_differenz`, diff >= 0 ? `+${diff}` : `${diff}`, true);
  }, 5000);
});

// --- 3. FORTSCHRITT (Minütlich) ---
schedule("* * * * *", () => {
  const now = new Date();
  const sunset = getAstroDate("sunset");
  const sunrise = getAstroDate("sunrise");
  const tageslaengeMin = getState(`${BASE_PATH}tageslaenge_in_minuten`)?.val;

  // Minuten bis Sonnenuntergang
  const restLichtMin = Math.floor((sunset - now) / 60000);

  if (restLichtMin > 0 && restLichtMin <= tageslaengeMin) {
    const prozent = Math.round((restLichtMin * 100) / tageslaengeMin);
    setState(`${BASE_PATH}tageslaenge_fortschritt`, prozent.toString(), true);
    setState(`${BASE_PATH}tageslaenge_tageslicht_in_minuten`, restLichtMin.toString(), true);

    const h = Math.floor(restLichtMin / 60)
      .toString()
      .padStart(2, "0");
    const m = (restLichtMin % 60).toString().padStart(2, "0");
    setState(`${BASE_PATH}tageslaenge_tageslicht`, `${h}:${m}`, true);
    setState(`${BASE_PATH}nachtlaenge_keinlicht`, "00:00", true);
  } else {
    setState(`${BASE_PATH}tageslaenge_tageslicht`, "00:00", true);
    // Nachtfortschritt Logik
    let restNachtMin = 0;
    if (now > sunset) {
      const morgenSunrise = getAstroDate("sunrise", new Date().setDate(now.getDate() + 1));
      restNachtMin = Math.floor((morgenSunrise - now) / 60000);
    } else {
      restNachtMin = Math.floor((sunrise - now) / 60000);
    }

    const nTotal = getState(`${BASE_PATH}nachtlaenge_in_minuten`)?.val;
    const nProzent = Math.round((restNachtMin * 100) / nTotal);
    setState(`${BASE_PATH}nachtlaenge_fortschritt`, nProzent.toString(), true);

    const nh = Math.floor(restNachtMin / 60)
      .toString()
      .padStart(2, "0");
    const nm = (restNachtMin % 60).toString().padStart(2, "0");
    setState(`${BASE_PATH}nachtlaenge_keinlicht`, `${nh}:${nm}`, true);
  }
});

// --- 4. MOND & SOLAR NOON (Einmal nachts) ---
schedule("3 0 * * *", () => {
  const mAuf = getState("pirate-weather.0.weather.daily.00.moonrise")?.val;
  const mUnter = getState("pirate-weather.0.weather.daily.00.moonset")?.val;
  setState(`${BASE_PATH}mondaufgang`, formatTime(new Date(mAuf)), true);
  setState(`${BASE_PATH}monduntergang`, formatTime(new Date(mUnter)), true);
});

schedule("2 0 * * *", () => {
  const sNoon = getState("pirate-weather.0.weather.daily.00.solarNoon")?.val;
  setState(`${USER_DATA_PATH}SolarNoon`, formatTime(new Date(sNoon)), true);
});
