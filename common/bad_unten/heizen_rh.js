/* eslint-env es2022 */
/**
 * =============================================================================
 * BAD-ENTFEUCHTUNG ÜBER FUSSBODENHEIZUNG (Bad unten)
 * =============================================================================
 * ZWECK:
 * Wenn die Luftfeuchtigkeit im Bad (z.B. nach dem Duschen) stark ansteigt,
 * wird die Heizung kurzzeitig auf 24°C hochgefahren, um die Feuchtigkeit zu binden
 * und das Abtrocknen der Wände/Fliesen zu beschleunigen (Schimmelprävention).
 *
 * LOGIK-FEATURES:
 * 1. Fenster-Schutz: Entfeuchtung startet nur bei geschlossenem Fenster und wenn
 * die Heizung nicht ausgeschaltet ist.
 * 2. Race-Condition-Fix: Speichert die Soll-Temperatur nur, wenn sie > 12°C ist,
 *    um zu verhindern, dass die "Fenster-offen-Temperatur" (10°C) als Rückkehrwert
 *    gespeichert wird.
 * 3. Automatischer Abbruch: Wird das Fenster geöffnet, stoppt der Modus sofort.
 * 4. Rückfall-Ebene: Stellt nach Beendigung entweder die alte Temperatur oder
 *    Standardwerte (Tag/Nacht) wieder her.
 */

// --- Konfiguration IDs ---
const ID_HUMIDITY = "alias.0.bad_unten.heizung.HUMIDITY";
const ID_SET_TEMP = "alias.0.bad_unten.heizung.SET_POINT_TEMPERATURE";
const ID_ACTUAL_TEMP = "alias.0.bad_unten.heizung.ACTUAL_TEMPERATURE";
const ID_WINDOW_STATE = "alias.0.bad_unten.heizung.WINDOW_STATE"; // 0 = zu
const ID_HEATING_MODE =
  "vaillant.0.44c040a5-2e4f-4933-b508-22584e0854c2.configuration.zones01.heating.operationModeHeating";
const ID_ENTFEUCHTEN_VOTUM = "0_userdata.0.Heizen.Feuchte.Bad_unten.entfeuchten";

// Initialisierung mit Sicherheitscheck
// Falls das Skript startet, während das Fenster offen ist (10°C), setzen wir 21°C als Default-Rückkehrwert.
let vorigesTemperaturLevel = getState(ID_SET_TEMP)?.val > 12 ? getState(ID_SET_TEMP)?.val : 21;
let istAmEntfeuchten = false; // Status-Variable: Befinden wir uns gerade im Entfeuchtungs-Modus?

// --- HAUPTLOGIK: REAKTION AUF FEUCHTIGKEITSÄNDERUNG ---
on({ id: ID_HUMIDITY, change: "ne" }, async (obj) => {
  const luftfeuchte = obj.state.val;
  const fensterZu = getState(ID_WINDOW_STATE)?.val === 0;
  const istTempNiedrig = getState(ID_ACTUAL_TEMP)?.val < 24;
  const heizungAn = getState(ID_HEATING_MODE)?.val !== "OFF";

  /**
   * START-BEDINGUNG:
   * 1. Feuchtigkeit >= 60%
   * 2. Fenster ist geschlossen
   * 3. Raum ist noch nicht auf 24°C aufgeheizt
   * 4. Heizung ist im Automatik/Manu-Modus (nicht auf Aus)
   * 5. Wir entfeuchten nicht bereits
   */
  if (luftfeuchte >= 60 && fensterZu && istTempNiedrig && heizungAn && !istAmEntfeuchten) {
    // SCHUTZ VOR DER 10°C-FALLE:
    // Wir lesen die aktuelle Soll-Temperatur. Wenn sie <= 12°C ist, ignorieren wir sie
    // beim Speichern, da es sich wahrscheinlich um die Absenktemperatur des Fensters handelt.
    const aktuelleSollTemp = getState(ID_SET_TEMP)?.val;
    if (aktuelleSollTemp > 12) vorigesTemperaturLevel = aktuelleSollTemp;

    istAmEntfeuchten = true; // Status sperren

    setState(ID_SET_TEMP, 24); // Heizung voll aufdrehen
    setState(ID_ENTFEUCHTEN_VOTUM, true, true); // Status für andere Skripte/VIS setzen

    sendGlobalNotify(
      `♨️ Entfeuchtung im Bad unten gestartet (${luftfeuchte}% rL).\nTemperatur auf 24°C gesetzt (vorher ${vorigesTemperaturLevel}°C).`,
      "",
      1,
    );
  } else if (luftfeuchte <= 57 && fensterZu && istAmEntfeuchten) {
    /**
     * STOPP-BEDINGUNG:
     * 1. Feuchtigkeit ist wieder unter 57% gefallen
     * 2. Fenster ist immer noch zu (wird Fenster geöffnet, greift der separate Trigger unten)
     * 3. Modus war aktiv
     */
    istAmEntfeuchten = false;
    setState(ID_ENTFEUCHTEN_VOTUM, false, true);

    // ZIELTEMPERATUR BESTIMMEN:
    let neueTemp = vorigesTemperaturLevel;
    const istTag = compareTime("05:00", "22:00", "between");
    const programmZuhause = getState("0_userdata.0.Heizen.Programme.Zuhause")?.val;

    if (istTag && programmZuhause) {
      // Falls wir zu Hause sind und es Tag ist, erzwingen wir 21°C Komforttemperatur
      neueTemp = 21;
    } else if (neueTemp <= 12) {
      // Sicherheits-Fallback: Falls doch 10°C gespeichert wurden,
      // nehmen wir 18°C für die Nacht/Abwesenheit.
      neueTemp = 18;
    }

    setState(ID_SET_TEMP, neueTemp);
    sendGlobalNotify(
      `✅ Entfeuchtung im Bad unten beendet (${luftfeuchte}% rL).\nHeizung wieder auf ${neueTemp}°C eingestellt.`,
      "",
      1,
    );
  }
});

// --- SOFORT-STOPP BEI FENSTERÖFFNUNG ---
// Reagiert sofort auf den Fensterkontakt, unabhängig von der Luftfeuchtigkeit.
on({ id: ID_WINDOW_STATE, change: "ne" }, (obj) => {
  if (obj.state.val !== 0 && istAmEntfeuchten) {
    istAmEntfeuchten = false;
    setState(ID_ENTFEUCHTEN_VOTUM, false, true);
    // Hinweis: Hier wird SET_POINT_TEMPERATURE nicht geändert, da das Thermostat
    // durch seinen eigenen "Fenster-Modus" automatisch auf 10°C springt.
  }
});

// --- SCHUTZ VOR MANUELLER ÄNDERUNG ---
// Verhindert, dass jemand am Thermostat dreht, während die Entfeuchtung läuft.
on({ id: ID_SET_TEMP, change: "ne", ack: false }, (obj) => {
  // Nur wenn Fenster zu ist (sonst darf das Thermostat auf 10°C regeln)
  if (istAmEntfeuchten && getState(ID_WINDOW_STATE)?.val === 0) {
    // Wenn jemand eine andere Temperatur als 24°C einstellt:
    if (obj.state.val !== 24) {
      setState(ID_SET_TEMP, 24); // Zurück auf 24 erzwingen
      //console.log("Manuelle Änderung während Entfeuchtung blockiert.");
    }
  }
});
