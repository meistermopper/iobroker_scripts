/* eslint-env es2022 */
/**
 * Name:   Abendlicht Wohnzimmer Master (V6.5)
 * Zweck:  Steuerung des Abendlichts im Wohnzimmer (Kommode & Ei) mit sanftem Übergang ab 22:30 Uhr.
 * Fix:    Verhindert GHOME 400 INVALID_ARGUMENT Fehler durch vollständiges Ausblenden aller rohen Hue-Hardware-Datenpunkte (inkl. hue.0.Ei.ct) sowie aller Hilfs-Datenpunkte.
 */

// --- 1. KONFIGURATION DER DATENPUNKTE ---

// Der Trigger-Datenpunkt (True = An, False = Aus)
const ID_TRIGGER = "0_userdata.0.Licht.Wohnzimmer.Abendlicht";

// Pfade zu den Command-Datenpunkten (Basierend auf deinem Screenshot)
const ALIAS_KOMMODE = "alias.0.licht.kommode.command";
const ALIAS_EI = "alias.0.licht.ei.command";

// Hardware-Ziele für die Reparatur der Alias-Verknüpfung
const TARGET_KOMMODE = "hue.0.Kommode.command";
const TARGET_EI = "hue.0.Ei.command";

// --- 2. WERTE-KONFIGURATION (Hardware-Safe) ---

const START_BRI_KOMMODE = 40;
const START_BRI_EI = 60;
const START_CT_EI = 396; // 2525K (Warmweiß) -> 1000000 / 2525 = 396 Mireds

const END_BRI_KOMMODE = 20;
const END_BRI_EI = 20;
const END_CT_EI = 500; // 2000K (Untergrenze Kelvin) -> 1000000 / 2000 = 500 Mireds

const START_FADE_IN_SEC = 50;
const TRANSITION_DURATION = 27000; // 45 Minuten

let transitionSchedule = null;

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
          else console.log(`[Abendlicht] Info: Alias ${cfg.id} initialized`);
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
          else console.log(`[Abendlicht] Info: Target ${cfg.target} initialized`);
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
          else console.log(`[Abendlicht] Info: Hidden object ${id} from GHOME/Alexa`);
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
          else console.log(`[Abendlicht] Info: Configured ct state ${id} (mired/153-500)`);
        },
      );
    }
  });
}

// Initialisierung beim Skriptstart
repairAndHide();

// --- 4. HAUPT-LOGIK ---

on({ id: ID_TRIGGER, change: "ne", ack: false }, (obj) => {
  const sollAn = !!obj.state.val;

  if (transitionSchedule) {
    clearSchedule(transitionSchedule);
    transitionSchedule = null;
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
    setTimeout(() => setState(ALIAS_EI, fadeInEi), 1500);

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

      setTimeout(() => {
        setState(
          ALIAS_EI,
          JSON.stringify({
            level: limit(END_BRI_EI, 0, 100),
            ct: limit(END_CT_EI, 153, 500),
            transitiontime: limit(TRANSITION_DURATION, 0, 65535),
          }),
        );
      }, 1500);
    });
  } else {
    // Notification für Ausschalten (gemäß Vorgabe auskommentiert)
    //console.log(`[Abendlicht] Ausschalten.`);

    const off = JSON.stringify({ on: false, transitiontime: 20 });
    setState(ALIAS_KOMMODE, off);
    setTimeout(() => setState(ALIAS_EI, off), 1500);
  }
});
