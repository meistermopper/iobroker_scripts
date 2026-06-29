/**
 * =============================================================================
 * LICHTSTEUERUNG BAD UNTEN (BEWEGUNG & TAGESZEIT) v1.1 - Kommentiert
 * =============================================================================
 * ZWECK:
 * Dieses Skript steuert das Licht im unteren Badezimmer basierend auf Bewegung,
 * Helligkeit, Tageszeit und Wochentag. Es bietet verschiedene Lichtszenen
 * (z.B. helles Morgenlicht, Standardlicht) und eine automatische Abschaltung
 * mit Vorwarnung.
 *
 * FUNKTIONSWEISE:
 * 1. BEI BEWEGUNG:
 *    - Wenn es dunkel genug ist und die Automatik aktiv ist, wird `lichtAn()` aufgerufen.
 *    - `lichtAn()` setzt je nach Uhrzeit und Wochentag eine passende Lichtszene.
 *    - Jeder Bewegungsimpuls startet die Timer für Vorwarnung (25 Min) und
 *      Abschaltung (30 Min) neu.
 *
 * 2. VORWARNUNG:
 *    - Nach 25 Minuten ohne neue Bewegung wird das Licht kurz gedimmt, um auf
 *      die bevorstehende Abschaltung hinzuweisen.
 *
 * 3. ABSCHALTUNG:
 *    - Nach 30 Minuten ohne neue Bewegung schaltet das Licht komplett aus.
 *    - Wird die Tür geöffnet, schaltet das Licht SOFORT aus (Priorität).
 * =============================================================================
 */

// --- 1. KONFIGURATION: DATENPUNKTE & VARIABLEN ---

// IDs der Sensoren und Aktoren
const ID_BWM = "alias.0.bad_unten.bwm.occupancy"; // Bewegungsmelder (true/false)
const ID_TUER = "alias.0.bad_unten.tuer.opened"; // Türsensor (true/false)
const ID_LUX = "alias.0.bad_unten.bwm.illuminance_raw"; // Helligkeitssensor (numerischer Wert)
const ID_BWM_ENABLE = "0_userdata.0.Licht.Bad_unten.BWM"; // Schalter, um diese Automatik global zu (de-)aktivieren

// IDs der Leuchtmittel (Hue & Sonoff)
const HUE_ON = "alias.0.bad_unten.licht.spiegel.on"; // An/Aus-Status der Spiegelleuchte
const HUE_LEVEL = "alias.0.bad_unten.licht.spiegel.level"; // Helligkeitslevel (Prozent)
const HUE_BRI = "alias.0.bad_unten.licht.spiegel.bri"; // Helligkeit (absoluter Wert 0-254)
const HUE_CT = "alias.0.bad_unten.licht.spiegel.ct"; // Farbtemperatur (Kelvin)
const SONOFF_PWR = "alias.0.bad_unten.licht.spots.POWER"; // An/Aus-Status der Decken-Spots

// Globale Variablen zur Verwaltung der Timer
let timeoutAusschalten = null; // Speichert den Timer für die endgültige Abschaltung
let timeoutVorwarnung = null; // Speichert den Timer für die Dimm-Vorwarnung
let timeoutGedenkpause = null; // Speichert einen kurzen Timer, um Sensor-"Flackern" zu entprellen

// --- 2. FUNKTIONEN ---

/**
 * Hilfsfunktion, die prüft, ob heute ein Arbeitstag (Montag-Freitag) ist.
 * @returns {boolean} True, wenn Mo-Fr, sonst false.
 */
function istArbeitstag() {
  const d = new Date().getDay(); // Gibt den Wochentag als Zahl (0=So, 1=Mo, ..., 6=Sa)
  return d >= 1 && d <= 5;
}

async function lichtAn() {
  const _jetzt = new Date();
  let bri = 30;
  let ct = 2700;
  let sonoffAn = false;

  // Zeitsteuerung Logik (wie gehabt)
  if (istArbeitstag() && compareTime("06:00", "10:00", "between")) {
    bri = 100;
    ct = 6494;
    sonoffAn = true;
  } else if (!istArbeitstag() && compareTime("08:00", "10:00", "between")) {
    bri = 100;
    ct = 6494;
    sonoffAn = true;
  } else if (compareTime("10:00", "21:00", "between")) {
    sonoffAn = true;
    bri = 0;
  }

  // Aktuelle Werte setzen
  if (bri > 0) {
    setState(HUE_LEVEL, 31);
    setStateDelayed(HUE_BRI, bri, 50, false);
    setStateDelayed(HUE_CT, ct, 50, false);
  }
  if (sonoffAn) setState(SONOFF_PWR, true);

  // Bestehende Timer löschen
  if (timeoutAusschalten) clearTimeout(timeoutAusschalten);
  if (timeoutVorwarnung) clearTimeout(timeoutVorwarnung);

  // VORWARNUNG: Nach 25 Minuten kurz auf 10% dimmen
  timeoutVorwarnung = setTimeout(() => {
    if (getState(HUE_ON)?.val) {
      // Nur wenn das Licht noch an ist
      const alterBri = getState(HUE_BRI)?.val;
      setState(HUE_BRI, 10); // Kurz dunkel machen
      //console.log("[Bad Unten] Vorwarnung: Dimme auf 10%");

      // Nach 5 Sekunden wieder auf den vorherigen Wert zurück (falls keine neue Bewegung kam)
      setTimeout(() => {
        if (timeoutAusschalten) setState(HUE_BRI, alterBri);
      }, 5000);
    }
  }, 1500000); // 25 Minuten

  // AUSSCHALTEN: Nach 30 Minuten
  timeoutAusschalten = setTimeout(() => {
    lichtAus();
  }, 1800000);
}

function lichtAus() {
  setState(HUE_ON, false);
  setState(SONOFF_PWR, false);
  if (timeoutAusschalten) {
    clearTimeout(timeoutAusschalten);
    timeoutAusschalten = null;
  }
  if (timeoutVorwarnung) {
    clearTimeout(timeoutVorwarnung);
    timeoutVorwarnung = null;
  }
  //console.log("[Bad Unten] Licht komplett aus");
}

// --- Trigger ---

on({ id: ID_BWM, change: "any" }, (obj) => {
  if (timeoutGedenkpause) clearTimeout(timeoutGedenkpause);

  timeoutGedenkpause = setTimeout(() => {
    const occupancy = !!obj.state.val;
    const istDunkel = getState(ID_LUX)?.val <= 15;
    const bwmAktiv = getState(ID_BWM_ENABLE)?.val;

    // Wenn Bewegung erkannt wird, Licht an oder Timer verlängern
    if (occupancy && istDunkel && bwmAktiv) {
      lichtAn();
    }
  }, 50); // Der 50ms Hardware-Delay
});

on({ id: ID_TUER, change: "gt" }, () => {
  lichtAus();
});
