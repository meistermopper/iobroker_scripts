/* eslint-env es2022 */
/**
 * Name:   CO-Melder Kachelofen Warnung (Alias-basiert)
 * Zweck:  Überwacht den Kohlenmonoxid-Melder unterhalb des Kachelofens im Wohnzimmer
 *         über den Alias "alias.0.wohnzimmer.klima.co_melder".
 *         Löst bei kritischen CO-Werten oder Alarmen unverzüglich eine lautstarke
 *         Sprachausgabe (SayIt mit 100% Lautstärke), Telegram- sowie Gotify-
 *         Benachrichtigungen mit höchster Priorität aus.
 */

// --- KONFIGURATION ---
const CONFIG = {
  // Physical Zigbee device ID (mapped to Alias)
  physicalDeviceId: "zigbee.0.a4c1382105693234",

  // Base alias path for the CO detector
  aliasBase: "alias.0.wohnzimmer.klima.co_melder",

  // Alias state IDs used throughout the script logic
  aliases: {
    alarm: "alias.0.wohnzimmer.klima.co_melder.carbon_monoxide",
    coPpm: "alias.0.wohnzimmer.klima.co_melder.co",
    battery: "alias.0.wohnzimmer.klima.co_melder.battery",
    available: "alias.0.wohnzimmer.klima.co_melder.available",
  },

  // Mapped physical states
  physical: {
    alarm: "zigbee.0.a4c1382105693234.carbon_monoxide",
    coPpm: "zigbee.0.a4c1382105693234.co",
    battery: "zigbee.0.a4c1382105693234.battery",
    available: "zigbee.0.a4c1382105693234.available",
  },

  // Thresholds
  ppmWarnThreshold: 50, // PPM warning threshold
  ppmCriticalThreshold: 100, // Critical PPM threshold
  lowBatteryThreshold: 15, // Low battery percentage warning threshold

  // Alarm settings
  repeatIntervalMs: 30000, // Repeat voice and push alarm every 30 seconds while active
  voiceVolume: 100, // Always loud for emergency warnings!
};

// --- VARIABLEN ---
let alarmRepeatTimer = null;
let isAlarmActive = false;

// --- INITIALISIERUNG & ALIAS-ERSTELLUNG ---

/**
 * Ensures all required alias states exist under alias.0.wohnzimmer.klima.co_melder.*
 */
async function initAliases() {
  await createStateAsync(CONFIG.aliases.alarm, false, {
    name: "CO Melder Kachelofen Alarm",
    type: "boolean",
    role: "sensor.alarm.fire",
    read: true,
    write: false,
    def: false,
  });

  await createStateAsync(CONFIG.aliases.coPpm, 0, {
    name: "CO Melder Kachelofen PPM",
    type: "number",
    role: "value.ppm",
    unit: "ppm",
    read: true,
    write: false,
    def: 0,
  });

  await createStateAsync(CONFIG.aliases.battery, 100, {
    name: "CO Melder Kachelofen Batteriestand",
    type: "number",
    role: "value.battery",
    unit: "%",
    read: true,
    write: false,
    def: 100,
  });

  await createStateAsync(CONFIG.aliases.available, true, {
    name: "CO Melder Kachelofen Erreichbarkeit",
    type: "boolean",
    role: "indicator.reachable",
    read: true,
    write: false,
    def: true,
  });

  // Initial sync from physical states to aliases
  syncPhysicalToAlias();
}

/**
 * Synchronizes physical Zigbee states to the created aliases.
 */
function syncPhysicalToAlias() {
  if (existsState(CONFIG.physical.alarm)) {
    const val = getState(CONFIG.physical.alarm)?.val;
    setState(CONFIG.aliases.alarm, !!val, true);
  }
  if (existsState(CONFIG.physical.coPpm)) {
    const val = getState(CONFIG.physical.coPpm)?.val;
    if (typeof val === "number") setState(CONFIG.aliases.coPpm, val, true);
  }
  if (existsState(CONFIG.physical.battery)) {
    const val = getState(CONFIG.physical.battery)?.val;
    if (typeof val === "number") setState(CONFIG.aliases.battery, val, true);
  }
  if (existsState(CONFIG.physical.available)) {
    const val = getState(CONFIG.physical.available)?.val;
    setState(CONFIG.aliases.available, !!val, true);
  }
}

// --- HILFSFUNKTIONEN ---

/**
 * Sends emergency notifications via Telegram, Gotify, and loud SayIt voice announcement.
 * @param {string} text - Message text
 * @param {string} title - Title for the notification
 * @param {number} priority - Priority level for Gotify (e.g., 10 for emergency)
 * @param {number|null} volume - Voice volume for SayIt (100 = maximum volume)
 * @param {string|null} voiceText - Optional text override for TTS
 */
function sendEmergencyNotify(
  text,
  title = "CO-ALARM KACHELOFEN",
  priority = 10,
  volume = CONFIG.voiceVolume,
  voiceText = null,
) {
  if (typeof sendGlobalNotify === "function") {
    sendGlobalNotify(text, title, priority, volume, voiceText);
  } else {
    // Fallback: direct notification calls if sendGlobalNotify is unavailable
    console.error(`[CO-Warnung] sendGlobalNotify function is missing! Logging alert: ${text}`);
    sendTo("telegram", "send", { text: `🚨 [${title}] ${text}`, parse_mode: "HTML" });
    sendTo("sayit", "say", { text: voiceText || text, volume: volume });
  }
}

/**
 * Starts repeated alarm announcements as long as the danger persists.
 * @param {string} reason - Cause of the alarm
 */
function startAlarmCycle(reason) {
  if (isAlarmActive) return;
  isAlarmActive = true;

  const alarmMsg = `🚨 GEFAHR! Kohlenmonoxid-Alarm am Kachelofen! ${reason}. Bitte umgehend lüften und den Raum verlassen!`;
  const voiceMsg = `Achtung! Kohlenmonoxid Alarm am Kachelofen! ${reason}! Raum sofort verlassen und lüften!`;

  // Initial immediate alert
  console.error(`[CO-Warnung] CRITICAL CO ALARM TRIGGERED: ${reason}`);
  sendEmergencyNotify(alarmMsg, "🚨 CO-ALARM KACHELOFEN", 10, CONFIG.voiceVolume, voiceMsg);

  // Set recurring alarm timer to repeat voice & push notification
  if (alarmRepeatTimer) clearInterval(alarmRepeatTimer);
  alarmRepeatTimer = setInterval(() => {
    if (isAlarmActive) {
      sendEmergencyNotify(alarmMsg, "🚨 CO-ALARM KACHELOFEN", 10, CONFIG.voiceVolume, voiceMsg);
    }
  }, CONFIG.repeatIntervalMs);
}

/**
 * Clears the active alarm cycle and sends a clear notification.
 */
function stopAlarmCycle() {
  if (!isAlarmActive) return;

  if (alarmRepeatTimer) {
    clearInterval(alarmRepeatTimer);
    alarmRepeatTimer = null;
  }
  isAlarmActive = false;

  const clearMsg = "✅ Entwarnung: Kohlenmonoxid-Wert am Kachelofen wieder im grünen Bereich.";
  const clearVoiceMsg = "Entwarnung. Kohlenmonoxid Wert am Kachelofen wieder normal.";

  console.log(`[CO-Warnung] ${clearMsg}`);
  sendEmergencyNotify(clearMsg, "✅ CO Entwarnung", 2, 70, clearVoiceMsg);
}

/**
 * Evaluates alias state values and triggers or resolves CO alarms.
 */
function checkCoStatus() {
  const alarmState = existsState(CONFIG.aliases.alarm)
    ? !!getState(CONFIG.aliases.alarm)?.val
    : false;
  const coPpmVal = existsState(CONFIG.aliases.coPpm) ? getState(CONFIG.aliases.coPpm)?.val : null;

  let isDanger = alarmState;
  let reason = "Sensor meldet CO-Auslösung";

  if (typeof coPpmVal === "number" && !Number.isNaN(coPpmVal)) {
    if (coPpmVal >= CONFIG.ppmCriticalThreshold) {
      isDanger = true;
      reason = `Kritischer Wert von ${coPpmVal} ppm erreicht`;
    } else if (coPpmVal >= CONFIG.ppmWarnThreshold) {
      isDanger = true;
      reason = `Erhöhter Wert von ${coPpmVal} ppm gemessen`;
    }
  }

  if (isDanger) {
    startAlarmCycle(reason);
  } else {
    stopAlarmCycle();
  }
}

// --- LOGIK & TRIGGER ---

// Synchronize changes from physical device to aliases
on(
  {
    id: new RegExp(
      `^${CONFIG.physicalDeviceId.replace(".", "\\.")}\\.(carbon_monoxide|co|battery|available)$`,
    ),
    change: "ne",
  },
  (obj) => {
    if (obj.id.endsWith(".carbon_monoxide")) {
      setState(CONFIG.aliases.alarm, !!obj.state.val, true);
    } else if (obj.id.endsWith(".co")) {
      setState(CONFIG.aliases.coPpm, Number(obj.state.val) || 0, true);
    } else if (obj.id.endsWith(".battery")) {
      setState(CONFIG.aliases.battery, Number(obj.state.val) || 0, true);
    } else if (obj.id.endsWith(".available")) {
      setState(CONFIG.aliases.available, !!obj.state.val, true);
    }
  },
);

// 1. Logic Trigger on boolean CO alarm alias state change
on({ id: CONFIG.aliases.alarm, change: "ne" }, () => {
  checkCoStatus();
});

// 2. Logic Trigger on numeric CO PPM concentration alias state change
on({ id: CONFIG.aliases.coPpm, change: "ne" }, () => {
  checkCoStatus();
});

// 3. Logic Trigger for low battery warning via alias
on({ id: CONFIG.aliases.battery, change: "ne" }, (obj) => {
  const batVal = obj.state.val;
  if (typeof batVal === "number" && batVal <= CONFIG.lowBatteryThreshold) {
    const batMsg = `🪫 CO-Melder Kachelofen: Batteriestand niedrig (${batVal}%). Bitte Batterie austauschen!`;
    console.warn(`[CO-Warnung] ${batMsg}`);
    sendEmergencyNotify(batMsg, "Batterie Warnung", 5, null); // Push only, no voice
  }
});

// 4. Logic Trigger for device reachability warning via alias
on({ id: CONFIG.aliases.available, change: "ne" }, (obj) => {
  const isOnline = !!obj.state.val;
  if (!isOnline) {
    const offlineMsg =
      "⚠️ WARNUNG: CO-Melder am Kachelofen ist OFFLINE! Die Sicherheitsüberwachung ist beeinträchtigt.";
    console.error(`[CO-Warnung] ${offlineMsg}`);
    sendEmergencyNotify(
      offlineMsg,
      "Gerät Offline",
      5,
      80,
      "Achtung! Der Kohlenmonoxid Melder am Kachelofen ist offline!",
    );
  } else {
    console.log("[CO-Warnung] CO-Melder Kachelofen ist wieder online.");
  }
});

// --- MAIN EXECUTION ---
initAliases().catch((err) => {
  console.error(`[CO-Warnung] Fehler bei der Alias-Initialisierung: ${err}`);
});

// --- CLEANUP ON UNLOAD ---
onStop(() => {
  if (alarmRepeatTimer) {
    clearInterval(alarmRepeatTimer);
    alarmRepeatTimer = null;
  }
});
