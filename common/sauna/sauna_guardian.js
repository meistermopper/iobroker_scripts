/* eslint-env es2022 */
/**
 * Name:   Sauna Guardian & Battery Protection
 * Zweck:  Dedicated sauna controller integration with Harvia Fenix.
 *         Protects the home battery against high-current discharge during sauna sessions,
 *         manages the central 'sauna_laeuft' interlock flag for Wallbox (charge_master)
 *         and media scripts, and enforces door safety monitoring.
 */

// --- 1. KONFIGURATION ---
const IDS = {
  // Harvia Fenix Adapter States
  saunaHeatOn: "harvia-fenix.0.heatOn", // Master session heating state (boolean)
  saunaHeaterPower: "harvia-fenix.0.heaterPower", // Physical heating element power in Watts
  saunaDoorSafety: "harvia-fenix.0.doorSafety", // Harvia safety switch (boolean)
  saunaTuer: "alias.0.sauna.tuer.opened", // Magnetic door contact (boolean)

  // Solax Wechselrichter / Hausbatterie (Modbus)
  batSoc: "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)", // Battery SoC (%)
  minSocRead: "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)", // Read current Min-SoC
  minSocSet: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)", // Write target Min-SoC

  // Zentrales Interlock-Flag & Persistence
  saunaLogik: "0_userdata.0.Haushalt.sauna_laeuft", // Central flag for Wallbox & Audio
  saunaHeiztAktiv: "0_userdata.0.Energie.Sauna.sauna_heizt_aktiv", // Real-time heating indicator
  minSocBackup: "0_userdata.0.Energie.PV.Sauna_MinSoc_Backup", // Persistent backup for Min-SoC
};

// Timing-Konstanten
const STOP_DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes cooldown debounce after Harvia turns off
const SAFETY_DOOR_TIMEOUT_MS = 60 * 1000; // 1 minute warning delay when heating with door open

// Interne Speicher & Timer
let isSystemInitialized = false;
let originalMinSoc = null;
let lastWrittenMinSoc = null;
let tSaunaReset = null;
let tSaunaSafety = null;

// --- 2. INITIALISIERUNG ---
async function initSystem() {
  const statesToCreate = [
    { id: IDS.saunaLogik, name: "sauna_laeuft", type: "boolean", def: false, role: "switch" },
    {
      id: IDS.saunaHeiztAktiv,
      name: "sauna_heizt_aktiv",
      type: "boolean",
      def: false,
      role: "indicator",
    },
    { id: IDS.minSocBackup, name: "Sauna_MinSoc_Backup", type: "number", def: 0, role: "value" },
  ];

  for (const s of statesToCreate) {
    if (!existsState(s.id)) {
      /** @type {any} */
      const stateType = s.type;
      await createStateAsync(s.id, s.def, {
        name: s.name,
        type: stateType,
        role: s.role,
        read: true,
        write: true,
      });
    }
  }

  // Restore existing backup value if present (e.g. after script restart during active session)
  if (existsState(IDS.minSocBackup)) {
    const backupVal = getState(IDS.minSocBackup)?.val;
    if (typeof backupVal === "number" && backupVal > 0) {
      originalMinSoc = backupVal;
      console.log(`[Sauna Guardian] Restored MinSoC backup from persistence: ${originalMinSoc}%`);
    }
  }

  // Check current hardware state on startup
  const isHeatOn = existsState(IDS.saunaHeatOn) && getState(IDS.saunaHeatOn)?.val === true;
  if (isHeatOn) {
    console.log(
      "[Sauna Guardian] Sauna is actively heating at system startup. Engaging battery protection.",
    );
    startSauna();
  } else {
    // If Harvia is off, ensure saunaLogik is consistent
    const currentLogik = getState(IDS.saunaLogik)?.val === true;
    if (currentLogik && originalMinSoc === null) {
      // Stale state after restart
      setState(IDS.saunaLogik, false, true);
    }
  }

  // Initial door safety check
  checkSaunaSafety();

  isSystemInitialized = true;
  console.log("[Sauna Guardian] System initialized successfully.");
}

// --- 3. SAUNA-STEUERUNG & BATTERIESCHUTZ ---

/**
 * Activates battery protection and sets the system interlock flag.
 */
function startSauna() {
  if (tSaunaReset) {
    clearTimeout(tSaunaReset);
    tSaunaReset = null;
    console.log("[Sauna Guardian] Cooldown timer cancelled. Sauna session resumed.");
  }

  // Backup original MinSoC ONLY if no backup is currently held (prevents overwriting with elevated values)
  if (originalMinSoc === null) {
    const currentMinSoc = getState(IDS.minSocRead)?.val;
    if (typeof currentMinSoc === "number" && currentMinSoc > 0) {
      originalMinSoc = currentMinSoc;
      setState(IDS.minSocBackup, originalMinSoc, true);
      console.log(`[Sauna Guardian] Original MinSoC backed up: ${originalMinSoc}%`);
    } else {
      originalMinSoc = 15; // Conservative default fallback
      setState(IDS.minSocBackup, originalMinSoc, true);
      console.warn(
        `[Sauna Guardian] Could not read valid MinSoC, using fallback backup: ${originalMinSoc}%`,
      );
    }
  }

  setState(IDS.saunaLogik, true, true);

  // Lock battery at current SoC immediately to prevent high-current discharge
  const soc = Number(getState(IDS.batSoc)?.val) || 0;
  if (soc > 0 && lastWrittenMinSoc !== soc) {
    setState(IDS.minSocSet, soc);
    lastWrittenMinSoc = soc;
    console.log(`[Sauna Guardian] Sauna active: Home battery MinSoC locked to ${soc}%`);
  }
}

/**
 * Initiates cooldown debounce before restoring battery settings and clearing interlock.
 */
function stopSauna() {
  if (tSaunaReset) return; // Debounce already in progress

  console.log(
    `[Sauna Guardian] Sauna heating stopped. Cooldown debounce started (${STOP_DEBOUNCE_MS / 1000}s)...`,
  );

  tSaunaReset = setTimeout(() => {
    tSaunaReset = null;

    if (originalMinSoc !== null) {
      setState(IDS.minSocSet, originalMinSoc);
      console.log(
        `[Sauna Guardian] Cooldown completed. Restored home battery MinSoC to ${originalMinSoc}%.`,
      );
      originalMinSoc = null;
      lastWrittenMinSoc = null;
      setState(IDS.minSocBackup, 0, true);
    }

    setState(IDS.saunaLogik, false, true);
    setState(IDS.saunaHeiztAktiv, false, true);
    console.log(
      "[Sauna Guardian] Sauna interlock released (sauna_laeuft = false). Wallbox & media unblocked.",
    );
  }, STOP_DEBOUNCE_MS);
}

/**
 * Dynamically tracks SoC increase if PV surplus charges the battery during sauna operation.
 */
function trackBatterySoC() {
  if (!isSystemInitialized) return;
  const isSaunaActive = getState(IDS.saunaLogik)?.val === true;
  if (!isSaunaActive) return;

  const currentSoc = Number(getState(IDS.batSoc)?.val) || 0;
  const currentMinSoc = Number(getState(IDS.minSocRead)?.val) || 0;

  // Only update if SoC increased above both current register and our last written value
  if (currentSoc > currentMinSoc && currentSoc > (lastWrittenMinSoc || 0)) {
    setState(IDS.minSocSet, currentSoc);
    lastWrittenMinSoc = currentSoc;
    console.log(`[Sauna Guardian] Battery charged to ${currentSoc}%. Updated MinSoC lock.`);
  }
}

// --- 4. TÜR-SICHERHEITSWACHE ---

/**
 * Evaluates door status and heating element power to sound an alert if door remains open.
 */
function checkSaunaSafety() {
  const isDoorOpen =
    getState(IDS.saunaTuer)?.val === true ||
    (existsState(IDS.saunaDoorSafety) && getState(IDS.saunaDoorSafety)?.val === false);

  const heatOn = existsState(IDS.saunaHeatOn) && getState(IDS.saunaHeatOn)?.val === true;
  const heaterPower = Number(getState(IDS.saunaHeaterPower)?.val) || 0;
  const isHeating = heatOn && heaterPower > 0;

  setState(IDS.saunaHeiztAktiv, isHeating, true);

  if (isDoorOpen && isHeating) {
    if (!tSaunaSafety) {
      tSaunaSafety = setTimeout(() => {
        tSaunaSafety = null;
        // Verify conditions are still true after timeout
        const stillOpen =
          getState(IDS.saunaTuer)?.val === true ||
          (existsState(IDS.saunaDoorSafety) && getState(IDS.saunaDoorSafety)?.val === false);
        const stillHeating =
          getState(IDS.saunaHeatOn)?.val === true &&
          (Number(getState(IDS.saunaHeaterPower)?.val) || 0) > 0;

        if (stillOpen && stillHeating) {
          const alertMsg = "Achtung: Die Sauna heizt bei offener Tür! Bitte überprüfen.";
          console.warn(`[Sauna Guardian] ${alertMsg}`);
          if (typeof sendGlobalNotify === "function") {
            sendGlobalNotify(alertMsg, "Sauna Guardian", 8, 70);
          }
        }
      }, SAFETY_DOOR_TIMEOUT_MS);
    }
  } else if (tSaunaSafety) {
    // Door closed or heater turned off: cancel pending alert
    clearTimeout(tSaunaSafety);
    tSaunaSafety = null;
  }
}

// --- 5. EVENT LISTENERS ---

// Master Harvia Fenix trigger
if (existsState(IDS.saunaHeatOn)) {
  on({ id: IDS.saunaHeatOn, change: "ne" }, (obj) => {
    if (!isSystemInitialized) return;
    if (obj.state.val === true) {
      startSauna();
    } else {
      stopSauna();
    }
    checkSaunaSafety();
  });
}

// Harvia heater power trigger (updates real-time heating state & safety)
if (existsState(IDS.saunaHeaterPower)) {
  on({ id: IDS.saunaHeaterPower, change: "ne" }, () => {
    if (!isSystemInitialized) return;
    checkSaunaSafety();
  });
}

// Door contact triggers
if (existsState(IDS.saunaTuer)) {
  on({ id: IDS.saunaTuer, change: "ne" }, () => {
    if (!isSystemInitialized) return;
    checkSaunaSafety();
  });
}

if (existsState(IDS.saunaDoorSafety)) {
  on({ id: IDS.saunaDoorSafety, change: "ne" }, () => {
    if (!isSystemInitialized) return;
    checkSaunaSafety();
  });
}

// Battery SoC tracking during sauna sessions
if (existsState(IDS.batSoc)) {
  on({ id: IDS.batSoc, change: "ne" }, () => {
    trackBatterySoC();
  });
}

// --- 6. LIFECYCLE CLEANUP ---
onStop((callback) => {
  if (tSaunaReset) {
    clearTimeout(tSaunaReset);
    tSaunaReset = null;
  }
  if (tSaunaSafety) {
    clearTimeout(tSaunaSafety);
    tSaunaSafety = null;
  }
  console.log("[Sauna Guardian] Stopped and cleaned up all timers.");
  callback();
});

// Start initialization
initSystem();
