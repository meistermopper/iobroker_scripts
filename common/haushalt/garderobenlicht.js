/* eslint-env es2022 */
/**
 * Name:    Lichtsteuerung Garderobe (Govee Presence Follower)
 * Purpose: Controls the Govee wardrobe light (H6008, Cloud API) based on presence detection.
 *          Optimized to minimize Govee Cloud API requests and prevent rate-limiting (max 10 req/min):
 *          - Day mode (06:00 - 22:00): Brightness 55%, Color Temp 2800K
 *          - Night mode (22:00 - 06:00): Warm amber nightlight (#ffaa44), Brightness 20%
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
  colorTemp: 2800,
};

const NIGHT_CONFIG = {
  brightness: 20, // Sanfte Helligkeit im Nachtmodus (20%)
  colorRgb: "#ffaa44", // Weiches Bernstein / Honig-Gold
};

// Merker für den zuletzt gesetzten Modus ("day" | "night"), um unnötige Cloud-Calls zu sparen
let activeMode = null;

// --- 2. HILFSFUNKTIONEN ---

/**
 * Turns on the wardrobe light according to time of day.
 * Only sends color/brightness updates when transitioning between day and night mode
 * to stay well below Govee Cloud API rate limits.
 */
function einschalten() {
  const isDay = compareTime(DAY_START, DAY_END, "between");
  const targetMode = isDay ? "day" : "night";
  const isPowerOn = !!getState(IDS.power)?.val;

  if (targetMode === "day") {
    // Farbtemperatur und Helligkeit nur senden, wenn Modus gewechselt hat oder Werte abweichen
    if (activeMode !== "day") {
      if (getState(IDS.colorTemp)?.val !== DAY_CONFIG.colorTemp) {
        setState(IDS.colorTemp, DAY_CONFIG.colorTemp);
      }
      if (getState(IDS.brightness)?.val !== DAY_CONFIG.brightness) {
        setState(IDS.brightness, DAY_CONFIG.brightness);
      }
      activeMode = "day";
    }
    if (!isPowerOn) {
      setState(IDS.power, true);
    }
  } else {
    // Nacht-Modus: Bernstein-Nachtlicht ohne Cloud-feindliche 150ms-Dimmschleife
    if (activeMode !== "night") {
      if (String(getState(IDS.colorRgb)?.val).toLowerCase() !== NIGHT_CONFIG.colorRgb) {
        setState(IDS.colorRgb, NIGHT_CONFIG.colorRgb);
      }
      if (getState(IDS.brightness)?.val !== NIGHT_CONFIG.brightness) {
        setState(IDS.brightness, NIGHT_CONFIG.brightness);
      }
      activeMode = "night";
    }
    if (!isPowerOn) {
      setState(IDS.power, true);
    }
  }
}

/**
 * Turns off the wardrobe light if it is currently on.
 */
function ausschalten() {
  const isPowerOn = !!getState(IDS.power)?.val;
  if (isPowerOn) {
    setState(IDS.power, false);
  }
}

// --- 3. INITIALISIERUNG BEIM SKRIPTSTART ---
const initialPresence = !!getState(IDS.presence)?.val;
const initialPower = !!getState(IDS.power)?.val;

if (initialPresence) {
  einschalten();
} else if (initialPower) {
  ausschalten();
}

// --- 4. EVENT-LOGIK ---
on({ id: IDS.presence, change: "ne" }, (obj) => {
  const isPresent = !!obj.state.val;
  if (isPresent) {
    einschalten();
  } else {
    ausschalten();
  }
});
