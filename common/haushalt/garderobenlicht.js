/* eslint-env es2022 */
/**
 * Name:    Lichtsteuerung Garderobe (Govee Presence Follower)
 * Purpose: Controls the Govee wardrobe light based on presence detection.
 *          - Day mode (06:00 - 22:00): Brightness 55%, RGB #ffffff, Color Temp 2800K
 *          - Night mode (22:00 - 06:00): Warm amber nightlight (#ffaa44) with gentle ramp-up.
 */

// --- 1. KONFIGURATION ---
const IDS = {
  presence: "alias.0.garderobe.bwm.PRESENCE_DETECTION_STATE",
  power: "govee-smart.0.devices.h6008_8cda.control.power",
  brightness: "govee-smart.0.devices.h6008_8cda.control.brightness",
  colorRgb: "govee-smart.0.devices.h6008_8cda.control.color_rgb",
  colorTemp: "govee-smart.0.devices.h6008_8cda.control.color_temperature",
};

// Parameter für Tag & Nacht
const DAY_START = "06:00";
const DAY_END = "22:00";

const DAY_CONFIG = {
  brightness: 55,
  colorRgb: "#ffffff",
  colorTemp: 2800,
};

const NIGHT_CONFIG = {
  startBrightness: 2,
  targetBrightness: 20, // Maximale Helligkeit im Nachtmodus (20%)
  stepBrightness: 2, // Helligkeits-Schrittweite beim Aufdimmen
  stepIntervalMs: 150, // Schritt-Intervall in ms (~1.4s sanftes Aufdimmen)
  colorRgb: "#ffaa44", // Weiches Bernstein / Honig-Gold
};

// --- 2. ZUSTAND & TIMER ---
let dimmInterval = null;

// --- 3. HILFSFUNKTIONEN ---

/**
 * Stops any active dimming interval cleanly.
 */
function stopDimming() {
  if (dimmInterval) {
    clearInterval(dimmInterval);
    dimmInterval = null;
  }
}

/**
 * Turns on the wardrobe light according to time of day (day mode or dimmed night mode).
 */
function einschalten() {
  stopDimming();

  const isDay = compareTime(DAY_START, DAY_END, "between");

  if (isDay) {
    // Tag-Modus: Direkt mit gewünschter Helligkeit und Farbtemperatur einschalten
    setState(IDS.brightness, DAY_CONFIG.brightness);
    setState(IDS.colorRgb, DAY_CONFIG.colorRgb);
    setState(IDS.colorTemp, DAY_CONFIG.colorTemp);
    setState(IDS.power, true);
  } else {
    // Nacht-Modus: Bernstein-Nachtlicht sanft aufdimmen
    let currentBri = NIGHT_CONFIG.startBrightness;
    setState(IDS.colorRgb, NIGHT_CONFIG.colorRgb);
    setState(IDS.brightness, currentBri);
    setState(IDS.power, true);

    dimmInterval = setInterval(() => {
      currentBri += NIGHT_CONFIG.stepBrightness;
      if (currentBri >= NIGHT_CONFIG.targetBrightness) {
        setState(IDS.brightness, NIGHT_CONFIG.targetBrightness);
        stopDimming();
      } else {
        setState(IDS.brightness, currentBri);
      }
    }, NIGHT_CONFIG.stepIntervalMs);
  }
}

/**
 * Turns off the wardrobe light and halts any active dimming.
 */
function ausschalten() {
  stopDimming();
  const isPowerOn = !!getState(IDS.power)?.val;
  if (isPowerOn) {
    setState(IDS.power, false);
  }
}

// --- 4. INITIALISIERUNG BEIM SKRIPTSTART ---
const initialPresence = !!getState(IDS.presence)?.val;
const initialPower = !!getState(IDS.power)?.val;

if (initialPresence) {
  einschalten();
} else if (initialPower) {
  ausschalten();
}

// --- 5. EVENT-LOGIK ---
on({ id: IDS.presence, change: "ne" }, (obj) => {
  const isPresent = !!obj.state.val;
  if (isPresent) {
    einschalten();
  } else {
    ausschalten();
  }
});

// --- 6. LIFECYCLE CLEANUP ---
onStop((callback) => {
  stopDimming();
  callback();
});
