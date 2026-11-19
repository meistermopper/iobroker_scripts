/* eslint-env es2022 */
/**
 * Name:   Abendlicht Wohnzimmer Master (V6.6)
 * Zweck:  Steuerung des Abendlichts im Wohnzimmer (Kommode, Ei & Stehlampe) mit sanftem Übergang ab 22:30 Uhr.
 * Fix:    Verhindert GHOME 400 INVALID_ARGUMENT Fehler durch vollständiges Ausblenden aller rohen Hue-Hardware-Datenpunkte (inkl. hue.0.Ei.ct) sowie aller Hilfs-Datenpunkte.
 */

// --- 1. KONFIGURATION DER DATENPUNKTE ---

// Der Trigger-Datenpunkt (True = An, False = Aus)
const ID_TRIGGER = "0_userdata.0.Licht.Wohnzimmer.Abendlicht";

// Pfade zu den Command-Datenpunkten (Hue)
const ALIAS_KOMMODE = "alias.0.licht.kommode.command";
const ALIAS_EI = "alias.0.licht.ei.command";

// Pfade zu den Datenpunkten der Stehlampe
const ALIAS_STEHLAMPE = {
  power: "alias.0.wohnzimmer.licht.stehlampe.power",
  brightness: "alias.0.wohnzimmer.licht.stehlampe.brightness",
  colorRgb: "alias.0.wohnzimmer.licht.stehlampe.color_rgb",
  colorTemp: "alias.0.wohnzimmer.licht.stehlampe.color_temperature",
};

// Hardware-Ziele für die Reparatur der Alias-Verknüpfung
const TARGET_KOMMODE = "hue.0.Kommode.command";
const TARGET_EI = "hue.0.Ei.command";

// --- 2. WERTE-KONFIGURATION (Hardware-Safe) ---

const START_BRI_KOMMODE = 40;
const START_BRI_EI = 60;
const START_CT_EI = 396; // 2525K (Warmweiß) -> 1000000 / 2525 = 396 Mireds
const START_BRI_STEHLAMPE = 25; // Dezent & unauffällig im Hintergrund (25%)
const START_CT_STEHLAMPE = 2200; // Sehr gemütliches, warmes Licht (2200K)

const END_BRI_KOMMODE = 20;
const END_BRI_EI = 20;
const END_CT_EI = 500; // 2000K (Untergrenze Kelvin) -> 1000000 / 2000 = 500 Mireds
const END_BRI_STEHLAMPE = 10; // Ab 22:30 Uhr sanft auf 10% reduziert
const END_CT_STEHLAMPE = 2000; // Ab 22:30 Uhr noch wärmeres Kerzenlicht (2000K)

const START_FADE_IN_SEC = 50;
const TRANSITION_DURATION = 27000; // 45 Minuten

let transitionSchedule = null;
let autoOffTimeout = null;
let eiFadeInTimeout = null;
let eiTransitionTimeout = null;
let eiOffTimeout = null;
let stehlampeFadeInTimeout = null;
let stehlampeTransitionTimeout = null;
let stehlampeOffTimeout = null;

// --- 3. HILFSFUNKTIONEN & SYSTEM-FIXES ---

/**
 * Hält Werte innerhalb der Hardware-Limits.
 */
function limit(val, min, max) {
  return Math.min(Math.max(Math.round(val), min), max);
}

/**
 * Repairs alias objects and hides all raw hardware and non-interactive states from Google Home / Alexa.
 * Configures color temperature (ct) states with exact mired metadata to ensure iot.0 translates values cleanly to Kelvin.
 */
function repairAndHide() {
  const configs = [
    { id: ALIAS_KOMMODE, target: TARGET_KOMMODE },
    { id: ALIAS_EI, target: TARGET_EI },
  ];

  // 1. Repair alias command states and hide them from Google Home / Alexa smartName
  configs.forEach((cfg) => {
    if (existsObject(cfg.id)) {
      extendObject(
        cfg.id,
        {
          type: "state",
          common: {
            type: "string", // Hue commands are JSON strings
            role: "text", // Prevents GHOME/Alexa from auto-detecting this as a light/switch
            smartName: false,
          },
          native: {
            alias: {
              id: cfg.target, // Link to actual hardware target
            },
          },
        },
        (err) => {
          if (err) console.error(`[Abendlicht] Error repairing alias ${cfg.id}: ${err}`);
        },
      );
    }

    // 2. Hide hardware target command states from Google Home / Alexa
    if (existsObject(cfg.target)) {
      extendObject(
        cfg.target,
        {
          type: "state",
          common: {
            role: "text", // Prevents GHOME/Alexa from auto-detecting this as a light/switch
            smartName: false,
          },
        },
        (err) => {
          if (err) console.error(`[Abendlicht] Error configuring target ${cfg.target}: ${err}`);
        },
      );
    }
  });

  // 3. Disable GHOME/Alexa synchronization on all raw hardware devices/channels and unsupported states (.xy, .ct, .command, etc.)
  const objectsToHide = [
    // Raw Hue Hardware Devices & States
    "hue.0.Ei",
    "hue.0.Kommode",
    "hue.0.Ei.on",
    "hue.0.Ei.level",
    "hue.0.Ei.ct",
    "hue.0.Ei.xy",
    "hue.0.Ei.bri",
    "hue.0.Ei.hue",
    "hue.0.Ei.sat",
    "hue.0.Ei.command",
    "hue.0.Kommode.on",
    "hue.0.Kommode.level",
    "hue.0.Kommode.ct",
    "hue.0.Kommode.xy",
    "hue.0.Kommode.bri",
    "hue.0.Kommode.hue",
    "hue.0.Kommode.sat",
    "hue.0.Kommode.command",
    // Alias non-interactive / raw sub-states
    "alias.0.licht.ei.xy",
    "alias.0.licht.ei.command",
    "alias.0.licht.kommode.xy",
    "alias.0.licht.kommode.command",
  ];

  objectsToHide.forEach((id) => {
    if (existsObject(id)) {
      extendObject(
        id,
        {
          common: {
            smartName: false,
          },
        },
        (extendErr) => {
          if (extendErr) console.error(`[Abendlicht] Error hiding ${id}: ${extendErr}`);
        },
      );
    }
  });

  // 4. Configure alias color temperature (ct) state with proper unit to enable Mired -> Kelvin translation in iot.0
  const aliasCtStates = ["alias.0.licht.ei.ct"];

  aliasCtStates.forEach((id) => {
    if (existsObject(id)) {
      extendObject(
        id,
        {
          common: {
            role: "level.color.temperature",
            unit: "mired",
            min: 153,
            max: 500,
          },
        },
        (extendErr) => {
          if (extendErr)
            console.error(`[Abendlicht] Error updating ct config for ${id}: ${extendErr}`);
        },
      );
    }
  });

  console.log("[Abendlicht] System-Check: Aliase und SmartName-Filter bereit.");
}

// Initialisierung beim Skriptstart
repairAndHide();

// --- 4. HAUPT-LOGIK ---

/**
 * Explicitly turns off all three lamps and keeps the trigger state in sync.
 */
function turnOff() {
  if (transitionSchedule) {
    clearSchedule(transitionSchedule);
    transitionSchedule = null;
  }
  if (autoOffTimeout) {
    clearTimeout(autoOffTimeout);
    autoOffTimeout = null;
  }
  if (eiFadeInTimeout) {
    clearTimeout(eiFadeInTimeout);
    eiFadeInTimeout = null;
  }
  if (eiTransitionTimeout) {
    clearTimeout(eiTransitionTimeout);
    eiTransitionTimeout = null;
  }
  if (eiOffTimeout) {
    clearTimeout(eiOffTimeout);
    eiOffTimeout = null;
  }
  if (stehlampeFadeInTimeout) {
    clearTimeout(stehlampeFadeInTimeout);
    stehlampeFadeInTimeout = null;
  }
  if (stehlampeTransitionTimeout) {
    clearTimeout(stehlampeTransitionTimeout);
    stehlampeTransitionTimeout = null;
  }
  if (stehlampeOffTimeout) {
    clearTimeout(stehlampeOffTimeout);
    stehlampeOffTimeout = null;
  }

  const off = JSON.stringify({ on: false, transitiontime: 20 });
  setState(ALIAS_KOMMODE, off);
  eiOffTimeout = setTimeout(() => {
    setState(ALIAS_EI, off);
    eiOffTimeout = null;
  }, 1500);
  stehlampeOffTimeout = setTimeout(() => {
    setState(ALIAS_STEHLAMPE.power, false);
    stehlampeOffTimeout = null;
  }, 3000);

  // Synchronize trigger state with ack: true to prevent feedback loops
  if (getState(ID_TRIGGER)?.val) {
    setState(ID_TRIGGER, false, true);
  }
}

on({ id: ID_TRIGGER, change: "ne", ack: false }, (obj) => {
  const sollAn = !!obj.state.val;

  if (transitionSchedule) {
    clearSchedule(transitionSchedule);
    transitionSchedule = null;
  }
  if (autoOffTimeout) {
    clearTimeout(autoOffTimeout);
    autoOffTimeout = null;
  }
  if (eiFadeInTimeout) {
    clearTimeout(eiFadeInTimeout);
    eiFadeInTimeout = null;
  }
  if (eiTransitionTimeout) {
    clearTimeout(eiTransitionTimeout);
    eiTransitionTimeout = null;
  }
  if (eiOffTimeout) {
    clearTimeout(eiOffTimeout);
    eiOffTimeout = null;
  }
  if (stehlampeFadeInTimeout) {
    clearTimeout(stehlampeFadeInTimeout);
    stehlampeFadeInTimeout = null;
  }
  if (stehlampeTransitionTimeout) {
    clearTimeout(stehlampeTransitionTimeout);
    stehlampeTransitionTimeout = null;
  }
  if (stehlampeOffTimeout) {
    clearTimeout(stehlampeOffTimeout);
    stehlampeOffTimeout = null;
  }

  if (sollAn) {
    // Notification für Einschalten (gemäß Vorgabe auskommentiert)
    //console.log(`[Abendlicht] Einschalten: Start-Sequenz läuft...`);

    const fadeInKommode = JSON.stringify({
      on: true,
      level: limit(START_BRI_KOMMODE, 0, 100),
      transitiontime: limit(START_FADE_IN_SEC, 0, 65535),
    });

    const fadeInEi = JSON.stringify({
      on: true,
      level: limit(START_BRI_EI, 0, 100),
      ct: limit(START_CT_EI, 153, 500),
      transitiontime: limit(START_FADE_IN_SEC, 0, 65535),
    });

    setState(ALIAS_KOMMODE, fadeInKommode);
    eiFadeInTimeout = setTimeout(() => {
      setState(ALIAS_EI, fadeInEi);
      eiFadeInTimeout = null;
    }, 1500);

    // Stehlampe zeitversetzt mit unauffälligem, gemütlichem Warmlicht (2200K, 25%) einschalten
    stehlampeFadeInTimeout = setTimeout(() => {
      setState(ALIAS_STEHLAMPE.colorTemp, START_CT_STEHLAMPE);
      setState(ALIAS_STEHLAMPE.brightness, limit(START_BRI_STEHLAMPE, 1, 100));
      setState(ALIAS_STEHLAMPE.power, true);
      stehlampeFadeInTimeout = null;
    }, 3000);

    // Geplanter Übergang um 22:30 Uhr
    transitionSchedule = schedule("30 22 * * *", () => {
      // Notification für den Übergang (gemäß Vorgabe aktiv)
      console.log(`[Abendlicht] 22:30 Uhr: Sanfter Übergang startet`);

      setState(
        ALIAS_KOMMODE,
        JSON.stringify({
          level: limit(END_BRI_KOMMODE, 0, 100),
          transitiontime: limit(TRANSITION_DURATION, 0, 65535),
        }),
      );

      eiTransitionTimeout = setTimeout(() => {
        setState(
          ALIAS_EI,
          JSON.stringify({
            level: limit(END_BRI_EI, 0, 100),
            ct: limit(END_CT_EI, 153, 500),
            transitiontime: limit(TRANSITION_DURATION, 0, 65535),
          }),
        );
        eiTransitionTimeout = null;
      }, 1500);

      // Stehlampe um 22:30 Uhr noch weiter auf gemütliches Kerzenlicht (2000K, 10%) absenken
      stehlampeTransitionTimeout = setTimeout(() => {
        setState(ALIAS_STEHLAMPE.colorTemp, END_CT_STEHLAMPE);
        setState(ALIAS_STEHLAMPE.brightness, limit(END_BRI_STEHLAMPE, 1, 100));
        stehlampeTransitionTimeout = null;
      }, 3000);

      // Nach Ablauf der 45 Min. Abdimmzeit (um 23:15 Uhr) Lampen explizit ausschalten
      const transitionMs = (TRANSITION_DURATION / 10) * 1000;
      autoOffTimeout = setTimeout(() => {
        console.log(`[Abendlicht] 23:15 Uhr: Abdimmen beendet - schalte Lampen explizit aus.`);
        turnOff();
      }, transitionMs);
    });
  } else {
    turnOff();
  }
});

// Lifecycle cleanup when script stops
onStop((callback) => {
  if (transitionSchedule) clearSchedule(transitionSchedule);
  if (autoOffTimeout) clearTimeout(autoOffTimeout);
  if (eiFadeInTimeout) clearTimeout(eiFadeInTimeout);
  if (eiTransitionTimeout) clearTimeout(eiTransitionTimeout);
  if (eiOffTimeout) clearTimeout(eiOffTimeout);
  if (stehlampeFadeInTimeout) clearTimeout(stehlampeFadeInTimeout);
  if (stehlampeTransitionTimeout) clearTimeout(stehlampeTransitionTimeout);
  if (stehlampeOffTimeout) clearTimeout(stehlampeOffTimeout);
  callback();
});
