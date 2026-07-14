/* eslint-env es2022 */
/**
 * =============================================================================
 * SKRIPT: SMART-CHARGING ZENTRALE (V4.0 - mit Plugged-Erkennung)
 * =============================================================================
 * ZWECK:
 * Überwacht Akkustände und steuert Ladestationen zur Akkuschonung (30% bis 80%).
 *
 * * FEATURES:
 * 1. REBOOT-FEST: Speichert Zustände in '0_userdata.0' für Persistenz.
 * 2. SELF-HEALING: Erstellt fehlende Datenpunkte automatisch beim Start.
 * 3. SMART-NOTIFY: Unterdrückt "Bitte laden"-Meldungen, wenn das Gerät bereits
 *    als eingesteckt (plugged) erkannt wurde (implementiert für Thomas).
 * 4. SPRACH-STEUERUNG: Manuelle Lade-Trigger für Tablet und Smartphone.
 * 5. NACHT-RUHE: Sprachausgaben sind auf die Zeit von 08:00 bis 20:00 Uhr begrenzt.
 * 6. WARTUNGSARM: Keine komplexen Anwesenheitsprüfungen erforderlich.
 * =============================================================================
 */

// --- 1. KONFIGURATION DER GERÄTE ---
// Wir bündeln alle Infos in einem zentralen Objekt namens 'geraete'.
const geraete = {
  "Das Smartphone von Kiki": {
    levelId: "0_userdata.0.Energie.Smartphone.Kiki_level", // Woher kommt der Akkustand?
    powerId: "alias.0.wohnzimmer.energie.ladestation_kiki.Ladestation_Kiki.POWER", // Eigene Dose für Kiki
    notifiedFullId: "0_userdata.0.Energie.Smartphone.Kiki_MeldungVoll", // Speicher für "Schon gemeldet"
    lowBatId: "0_userdata.0.Energie.Smartphone.Kiki_lowBat", // Rotes Icon in der VIS
    min: 35,
    max: 80,
    notificationUser: "", // Grenzwerte (35% an, 80% aus)
  },
  "Das Smartphone von Thomas": {
    levelId: "0_userdata.0.Energie.Smartphone.Thomas_level",
    pluggedId: "0_userdata.0.Energie.Smartphone.Thomas_plugged", // Erkennt, ob das Gerät physisch verbunden ist
    powerId: "alias.0.wohnzimmer.energie.smartlader.on", // Nutzt den zentralen Alias
    notifiedFullId: "0_userdata.0.Energie.Smartphone.ThomasMeldungVoll", // Laut Grafik ohne Unterstrich
    lowBatId: "0_userdata.0.Energie.Smartphone.Thomas_lowBat",
    min: 30,
    max: 80,
    notificationUser: "Thomas",
  },
  "Das Tablet": {
    levelId: "0_userdata.0.Energie.Smartphone.Tablet_level",
    powerId: "alias.0.wohnzimmer.energie.smartlader.on", // Teilt sich die Dose mit Thomas
    notifiedFullId: "0_userdata.0.Energie.Smartphone.Tablet_MeldungVoll",
    lowBatId: "0_userdata.0.Energie.Smartphone.Tablet_lowBat",
    min: 30,
    max: 80,
    notificationUser: "",
  },
};

// --- 2. INITIALISIERUNG (DATENPUNKTE ERSTELLEN) ---
// Diese Funktion prüft beim Skriptstart, ob alle Datenpunkte existieren.
async function initStates() {
  for (const name of Object.keys(geraete)) {
    const config = geraete[name];

    // A. Der Sperr-Datenpunkt (verhindert doppelte Nachrichten)
    if (config.notifiedFullId && !existsState(config.notifiedFullId)) {
      await createStateAsync(config.notifiedFullId, false, {
        name: "Sperre Voll-Meldung",
        type: "boolean",
        role: "state",
        def: false,
      });
    }
    // B. Der LowBat-Datenpunkt (für die VIS Anzeige)
    if (config.lowBatId && !existsState(config.lowBatId)) {
      await createStateAsync(config.lowBatId, false, {
        name: "LowBat Anzeige",
        type: "boolean",
        role: "state",
        def: false,
      });
    }
    // C. Der "Lädt"-Datenpunkt (zeigt an, ob der Akku gerade steigt)
    const laedtId = config.levelId.replace("_level", "_laedt");
    if (!existsState(laedtId)) {
      await createStateAsync(laedtId, false, {
        name: "Ladestatus Aktiv",
        type: "boolean",
        role: "state",
        def: false,
      });
    }
    // D. NEU: Plugged-Status (erkennt ob Gerät verbunden ist)
    if (config.pluggedId && !existsState(config.pluggedId)) {
      await createStateAsync(config.pluggedId, false, {
        name: "Gerät am Stromnetz (Plugged)",
        type: "boolean",
        role: "state",
        def: false,
      });
    }
  }
}
initStates(); // Führt die Prüfung sofort beim Start aus

// --- 4. HAUPT-ÜBERWACHUNG ---
Object.keys(geraete).forEach((name) => {
  const config = geraete[name];

  // Wir "abonnieren" den Akkustand (levelId)
  on({ id: config.levelId, change: "ne" }, async (obj) => {
    const level = obj.state.val; // Neuer Prozentwert
    const istAn = getState(config.powerId)?.val; // Ist der Strom an?
    const alreadyNotified = getState(config.notifiedFullId)?.val; // Wurde heute schon gemeldet?

    // NEU: Prüfen, ob das Gerät eingesteckt ist (falls pluggedId in config vorhanden)
    const isPlugged = config.pluggedId ? getState(config.pluggedId)?.val : undefined;

    // 1. VIS LADESTATUS AKTUALISIEREN
    const targetLaedtId = config.levelId.replace("_level", "_laedt");
    if (existsState(targetLaedtId)) {
      // Wenn neuer Wert > alter Wert, dann lädt das Gerät
      setState(targetLaedtId, level > (obj.oldState ? obj.oldState.val : 0), true);
    }

    // 2. SPERRE ZURÜCKSETZEN
    // Wenn die Dose aus ist oder der Akku wieder leer wird, erlauben wir eine neue Meldung.
    if (!istAn || level < config.min) {
      if (alreadyNotified) setState(config.notifiedFullId, false, true);
    }

    // 3. EINSCHALT-LOGIK (Akku < 30%)
    if (level < config.min && !istAn) {
      setState(config.powerId, true);
      if (config.lowBatId) setState(config.lowBatId, true);

      // LOGIK-OPTIMIERUNG:
      // Wir senden nur eine Nachricht, wenn das Gerät NICHT eingesteckt ist (isPlugged === false).
      // Wenn es bereits eingesteckt ist (true), aktivieren wir nur lautlos den Strom.
      // Geräte ohne plugged-Sensor (wie Kiki aktuell) melden sich wie gewohnt immer.
      if (isPlugged === true) {
        // Wenn eingesteckt, aber noch nicht geladen
        console.log(
          `[Smart-Charging] ${name} ist bereits eingesteckt (${level}%). Ladung wurde lautlos gestartet.`,
        );
      } else {
        await sendGlobalNotify(
          `🪫 ${name} sollte geladen werden.\nStand: ${level}%`,
          "",
          1, // Priorität
          compareTime("08:00", "20:00", "between") ? 50 : null, // Sprachausgabe Lautstärke 50
        );
      }
    }

    // 4. AUSSCHALT-LOGIK (Akku >= 80%)
    // Nur wenn Dose noch an ist UND wir für diesen Ladevorgang noch nicht gemeldet haben.
    else if (level >= config.max && istAn && !alreadyNotified) {
      setState(config.notifiedFullId, true, true); // Sperre im Datenpunkt setzen
      setState(config.powerId, false); // Dose ausschalten
      if (config.lowBatId) setState(config.lowBatId, false);
      await sendGlobalNotify(
        `🔋 ${name} ist geladen.\nStand: ${level}%`,
        "",
        1, // Priorität
        compareTime("08:00", "20:00", "between") ? 50 : null, // Sprachausgabe Lautstärke 50
      );
    }
  });
});

// --- 5. MANUELLER START (SPRACHBEFEHL) ---
// Reagiert auf die Datenpunkte Thomas_laden und Tablet_laden
const manualTriggers = [
  "0_userdata.0.Energie.Smartphone.Thomas_laden",
  "0_userdata.0.Energie.Smartphone.Tablet_laden",
];

on({ id: manualTriggers, val: true }, async (obj) => {
  // A. Ladegerät einschalten
  setState("alias.0.wohnzimmer.energie.smartlader.on", true);

  // B. Globale Benachrichtigung mit Sprachausgabe (asynchron)
  await sendGlobalNotify("Bitte links einstöpseln, ich habe eingeschaltet", "", 1, 50);

  // C. Den Button in der VIS nach 2 Sekunden wieder auf 'false' setzen
  setTimeout(() => {
    setState(obj.id, false, true);
  }, 2000);
});

// --- 6. KIKI MORGEN-CHECK (05:00 Uhr) ---
schedule("0 5 * * *", () => {
  const kiki = geraete["Das Smartphone von Kiki"];
  const level = getState(kiki.levelId)?.val;
  // Falls das Handy morgens unter 70% ist, vorsichtshalber laden
  if (level < 70 && !getState(kiki.powerId)?.val) {
    setState(kiki.powerId, true);
  }
});
