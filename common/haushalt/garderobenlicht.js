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
const DAY_START = "06:30";
const DAY_END = "22:00";

const DAY_CONFIG = {
  brightness: 55,
  colorTemp: 2800,
};

const NIGHT_CONFIG = {
  brightness: 20, // Sanfte Helligkeit im Nachtmodus (20%)
  colorRgb: "#ffaa44", // Weiches Bernstein / Honig-Gold
};

// Merker für den zuletzt an die Lampe gesendeten Modus ("day" | "night"),
// damit beim Wechsel Nacht -> Tag (und umgekehrt) die Farbtemperatur/Farbe
// garantiert einmalig an die Govee-Cloud übertragen wird.
let activeMode = null;

// --- 2. HILFSFUNKTIONEN ---

/**
 * Turns on the wardrobe light according to time of day.
 * Sends color/brightness updates once whenever transitioning between day and night mode
 * (or on first run after script start) to stay well below Govee Cloud API rate limits.
 */
function einschalten() {
  const isDay = compareTime(DAY_START, DAY_END, "between");
  const targetMode = isDay ? "day" : "night";
  const isPowerOn = !!getState(IDS.power)?.val;

  if (targetMode === "day") {
    // Beim Wechsel in den Tag-Modus einmalig zwingend Farbtemperatur & Helligkeit senden
    // (da der Datenpunkt color_temperature im ioBroker nachts auf 2800 stehen bleibt,
    // obwohl die Lampe physisch im RGB-Modus #ffaa44 war).
    if (activeMode !== "day") {
      setState(IDS.colorTemp, DAY_CONFIG.colorTemp);
      setState(IDS.brightness, DAY_CONFIG.brightness);
      activeMode = "day";
    }
    if (!isPowerOn) {
      setState(IDS.power, true);
    }
  } else {
    // Beim Wechsel in den Nacht-Modus einmalig zwingend RGB-Farbe & Helligkeit senden
    if (activeMode !== "night") {
      setState(IDS.colorRgb, NIGHT_CONFIG.colorRgb);
      setState(IDS.brightness, NIGHT_CONFIG.brightness);
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
