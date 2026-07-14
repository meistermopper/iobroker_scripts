/* eslint-env es2022 */
/**
 * =============================================================================
 * BAD-ENTFEUCHTUNG ÜBER FUSSBODENHEIZUNG (Bad oben)
 * =============================================================================
 * ZWECK:
 * Wenn die Luftfeuchtigkeit im Bad (z.B. nach dem Duschen) stark ansteigt,
 * wird die Heizung kurzzeitig auf 24°C hochgefahren, um die Feuchtigkeit zu binden
 * und das Abtrocknen der Wände/Fliesen zu beschleunigen (Schimmelprävention).
 *
 * LOGIK-FEATURES:
 * 1. Fenster-Schutz: Entfeuchtung startet nur bei geschlossenem Fenster.
 * 2. Race-Condition-Fix: Speichert die Soll-Temperatur nur, wenn sie > 12°C ist,
 *    um zu verhindern, dass die "Fenster-offen-Temperatur" (10°C) als Rückkehrwert
 *    gespeichert wird.
 * 3. Automatischer Abbruch: Wird das Fenster geöffnet, stoppt der Modus sofort.
 * 4. Rückfall-Ebene: Stellt nach Beendigung entweder die alte Temperatur oder
 *    Standardwerte (Tag/Nacht) wieder her.
 */

// --- KONFIGURATION der Datenpunkte---
const ID_HUMIDITY = "alias.0.bad_oben.klima.humidity";
const ID_TEMP_AKTUELL = "alias.0.bad_oben.klima.temperature";
const ID_SETPOINT = "alias.0.bad_oben.heizung.SET_POINT_TEMPERATURE";
const ID_HEIZUNG_STATE = "alias.0.bad_oben.fenster.STATE";
const ID_VAILLANT_MODE =
  "vaillant.0.44c040a5-2e4f-4933-b508-22584e0854c2.configuration.zones01.heating.operationModeHeating";
const ID_FEUCHTE_HOCH = "0_userdata.0.Heizen.Feuchte.Bad_oben.Feuchte_hoch";

// IDs für Programme
const ID_PROG_GAST = "0_userdata.0.Heizen.Programme.Gast_oben";
const ID_PROG_TAGUNG = "0_userdata.0.Heizen.Programme.Tagung";

// Initialisierung mit Sicherheitscheck
// Falls das Skript startet, während das Fenster offen ist (10°C), setzen wir 21°C als Default-Rückkehrwert.
let alteTemperatur = getState(ID_SETPOINT)?.val > 12 ? getState(ID_SETPOINT)?.val : 21;
let entfeuchten = false; // Status-Variable: Befinden wir uns gerade im Entfeuchtungs-Modus?

// --- LOGIK ---

// --- 1. HAUPTLOGIK: REAKTION AUF FEUCHTIGKEITSÄNDERUNG ---
on({ id: ID_HUMIDITY, change: "ne" }, async (obj) => {
  const luftfeuchte = obj.state.val;
  const fensterZu = getState(ID_HEIZUNG_STATE)?.val === 0;
  const aktuelleTemp = getState(ID_TEMP_AKTUELL)?.val;
  const vaillantNichtOff = getState(ID_VAILLANT_MODE)?.val !== "OFF";

  /**
   * START-BEDINGUNG:
   * 1. Feuchtigkeit >= 60%
   * 2. Fenster ist geschlossen (ID_HEIZUNG_STATE === 0)
   * 3. Raum ist noch nicht auf 24°C aufgeheizt
   * 4. Heizung ist im Automatik/Manu-Modus (nicht auf Aus)
   * 5. Wir entfeuchten nicht bereits
   */
  if (luftfeuchte >= 60 && fensterZu && aktuelleTemp < 24 && vaillantNichtOff && !entfeuchten) {
    // SCHUTZ VOR DER 10°C-FALLE:
    // Wir lesen die aktuelle Soll-Temperatur. Wenn sie <= 12°C ist, ignorieren wir sie
    // beim Speichern, da es sich wahrscheinlich um die Absenktemperatur des Fensters handelt.
    const aktuelleSollTemp = getState(ID_SETPOINT)?.val;
    if (aktuelleSollTemp > 12) alteTemperatur = aktuelleSollTemp;

    entfeuchten = true; // Status sperren

    setState(ID_SETPOINT, 24); // Heizung voll aufdrehen
    setState(ID_FEUCHTE_HOCH, true, true); // Status für andere Skripte/VIS setzen

    const msg =
      `♨️ Die Entfeuchtung im Bad oben wurde gestartet (${luftfeuchte}% rL).\n` +
      `Die Temperatur wurde auf 24°C eingestellt.\n` +
      `Vorherige Zieltemperatur: ${alteTemperatur}°C.`;
    await sendGlobalNotify(msg, "", 1, null); // Keine Sprachausgabe, da es nur eine Info ist
    await sendGlobalNotify(msg, "", 1, null); // Keine Sprachausgabe, da es nur eine Info ist
  } else if (luftfeuchte <= 57 && obj.oldState.val > luftfeuchte && fensterZu && entfeuchten) {
    /**
     * STOPP-BEDINGUNG:
     * 1. Feuchtigkeit ist wieder unter 57% gefallen
     * 2. Feuchtigkeit sinkt aktuell (obj.oldState.val > luftfeuchte)
     * 3. Fenster ist immer noch zu
     * 4. Modus war aktiv
     */
    entfeuchten = false;
    setState(ID_FEUCHTE_HOCH, false, true);

    // ZIELTEMPERATUR BESTIMMEN:
    let neueTemp = alteTemperatur;
    const istTag = compareTime("05:00", "22:00", "between");
    const programmAktiv = getState(ID_PROG_GAST)?.val || getState(ID_PROG_TAGUNG)?.val;

    if (istTag && programmAktiv) {
      // Falls ein Programm aktiv ist und es Tag ist, erzwingen wir 21°C
      neueTemp = 21;
    } else if (neueTemp <= 12) {
      // Sicherheits-Fallback: Falls doch 10°C gespeichert wurden,
      // nehmen wir 18°C für die Nacht/Abwesenheit.
      neueTemp = 18;
    }

    setState(ID_SETPOINT, neueTemp);

    const msg =
      `+++ ✅ Die Entfeuchtung im Bad oben wurde beendet +++\n` +
      `(${luftfeuchte}% rL). Heizung wieder auf ${neueTemp}°C. ✔️`;
    await sendGlobalNotify(msg, "Klima Bad Oben", 1, null); // Keine Sprachausgabe, da es nur eine Info ist
  }
});

// --- 2. SOFORT-STOPP BEI FENSTERÖFFNUNG ---
// Reagiert sofort auf den Fensterkontakt, unabhängig von der Luftfeuchtigkeit.
on({ id: ID_HEIZUNG_STATE, change: "ne" }, (obj) => {
  if (obj.state.val !== 0 && entfeuchten) {
    entfeuchten = false;
    setState(ID_FEUCHTE_HOCH, false, true);
    // Hinweis: Hier wird SET_POINT_TEMPERATURE nicht geändert, da das Thermostat
    // durch seinen eigenen "Fenster-Modus" automatisch auf 10°C springt.
  }
});

// --- 3. SCHUTZ VOR MANUELLER ÄNDERUNG ---
// Verhindert, dass jemand am Thermostat dreht, während die Entfeuchtung läuft.
on({ id: ID_SETPOINT, change: "ne", ack: false }, (obj) => {
  // Nur wenn Fenster zu ist (sonst darf das Thermostat auf 10°C regeln)
  if (entfeuchten && getState(ID_HEIZUNG_STATE)?.val === 0 && obj.state.val !== 24) {
    setState(ID_SETPOINT, 24); // Zurück auf 24 erzwingen
  }
});
