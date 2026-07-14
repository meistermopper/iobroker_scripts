/* eslint-env es2022 */
/**
 * =============================================================================
 * LICHTSTEUERUNG BAD OBEN v1.9.2
 * =============================================================================
 * ÄNDERUNG: Sicherheits-Ausschaltung auf 60 Minuten erhöht.
 * ÄNDERUNG: Vorwarn-Flackern auf 55 Minuten verschoben.
 * INFO: Alle Logs sind auskommentiert für einen sauberen ioBroker-Alltag.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const ID_BWM = "alias.0.bad_oben.bwm.occupancy";
const ID_TUER = "alias.0.bad_oben.tuer.opened";
const ID_LUX = "alias.0.bad_oben.bwm.illuminance_raw";
const ID_BWM_ENABLE = "0_userdata.0.Licht.Bad_oben.BWM";
const ID_LICHT = "alias.0.bad_oben.licht.POWER";

let timeoutAusschalten = null;
let timeoutVorwarnung = null;
let timeoutGedenkpause = null;
let sperreNachTuer = false;

// --- 2. FUNKTIONEN ---

function lichtAn() {
  if (sperreNachTuer) return;

  if (getState(ID_LICHT)?.val === false) {
    setState(ID_LICHT, true);
    // console.log("[Bad Oben] Licht AN (BWM-Trigger)");
  }

  // Bestehende Timer bei jeder neuen Bewegung zurücksetzen
  if (timeoutAusschalten) clearTimeout(timeoutAusschalten);
  if (timeoutVorwarnung) clearTimeout(timeoutVorwarnung);

  // VORWARNUNG: Nach 55 Minuten (3.300.000 ms) kurzes Flackern
  timeoutVorwarnung = setTimeout(() => {
    if (getState(ID_LICHT)?.val) {
      setState(ID_LICHT, false);
      setTimeout(() => {
        if (timeoutAusschalten) setState(ID_LICHT, true);
      }, 500);
    }
  }, 3300000);

  // DEFINITIVES AUS: Nach 60 Minuten (3.600.000 ms)
  timeoutAusschalten = setTimeout(() => {
    lichtAus();
  }, 3600000);
}

function lichtAus() {
  setState(ID_LICHT, false);
  if (timeoutAusschalten) {
    clearTimeout(timeoutAusschalten);
    timeoutAusschalten = null;
  }
  if (timeoutVorwarnung) {
    clearTimeout(timeoutVorwarnung);
    timeoutVorwarnung = null;
  }
  // console.log("[Bad Oben] Licht AUS");
}

// --- 3. TRIGGER ---

on({ id: ID_BWM, change: "any" }, (obj) => {
  if (timeoutGedenkpause) clearTimeout(timeoutGedenkpause);

  if (!obj.state) return; // Sicherheitscheck

  timeoutGedenkpause = setTimeout(() => {
    const occupancy = !!obj.state.val;
    const lux = getState(ID_LUX)?.val;
    const istDunkel = lux <= 15;
    const bwmAktiv = getState(ID_BWM_ENABLE)?.val;

    if (occupancy && istDunkel && bwmAktiv) {
      lichtAn();
    }
  }, 50);
});

on({ id: ID_TUER, change: "ne" }, (obj) => {
  if (!obj.state?.val) return; // Nur reagieren, wenn Tür offen (true)

  const lichtWarAn = getState(ID_LICHT)?.val;

  if (lichtWarAn) {
    lichtAus();
    sperreNachTuer = true;
    // console.log("[Bad Oben] Verlassen erkannt: Licht AUS & Sperre aktiv.");

    setTimeout(() => {
      sperreNachTuer = false;
    }, 5000);
  }
});
