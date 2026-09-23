/* eslint-env es2022 */
/**
 * Name:   Adapter Status Monitor
 * Zweck:  Überwacht Adapter-Instanzen auf Ausfälle und alarmiert nach Wartezeit.
 *         Filtert Adapter mit regelmäßigem Neustart (restartSchedule / schedule-Modus)
 *         automatisch heraus.
 */

// --- KONFIGURATION ---

// Pattern to match all adapter alive state IDs
const ID_PATTERN = /^system\.adapter\..*\..*\.alive$/;

// Delay in milliseconds before triggering an alert (e.g. 3 minutes)
const ALERT_DELAY_MS = 180000;

// Manual ignore list for adapter names or instance IDs that should not trigger alerts
const IGNORE_LIST = ["daswetter", "dwd", "feiertage", "ical", "pollenflug", "proxmox"];

// Active reconnect timers indexed by adapter instance ID
const pendingTimers = new Map();

// --- LOGIK ---

on({ id: ID_PATTERN, change: "ne" }, async (obj) => {
  // Only react when the adapter alive state changes to false (stopped or crashed)
  if (obj.state.val !== false) return;

  const adapterStateId = obj.id; // e.g. system.adapter.tr-064.0.alive
  const instanceId = adapterStateId.replace(/\.alive$/, ""); // e.g. system.adapter.tr-064.0
  const adapterNameOnly = instanceId.split(".")[2] || ""; // e.g. tr-064

  // Check manual ignore list first
  if (IGNORE_LIST.includes(adapterNameOnly) || IGNORE_LIST.includes(instanceId)) {
    return;
  }

  // Retrieve adapter instance configuration object from ioBroker database
  let instanceObj;
  try {
    instanceObj = await getObjectAsync(instanceId);
  } catch (err) {
    console.error(`[Adapter Monitor] Error retrieving object ${instanceId}: ${err}`);
  }

  if (instanceObj?.common) {
    const { restartSchedule, mode, enabled } = instanceObj.common;

    // 1. Ignore adapters with configured automatic restart schedule (CRON)
    if (typeof restartSchedule === "string" && restartSchedule.trim() !== "") {
      return;
    }

    // 2. Ignore adapters running in schedule or once mode (they terminate after work by design)
    if (mode === "schedule" || mode === "once") {
      return;
    }

    // 3. Ignore adapters that have been manually disabled
    if (enabled === false) {
      return;
    }
  }

  console.log(
    `[Adapter Monitor] ⚠️ Adapter ${instanceId} hat sich abgemeldet. Warte 3 Minuten auf Reconnect`,
  );

  // Clear any existing timer for this instance before setting a new one
  if (pendingTimers.has(instanceId)) {
    clearTimeout(pendingTimers.get(instanceId));
    pendingTimers.delete(instanceId);
  }

  // Delay alerting by 3 minutes to allow for transient reconnects
  const timer = setTimeout(async () => {
    pendingTimers.delete(instanceId);

    // Re-verify current alive status
    const currentStatus = getState(adapterStateId);

    if (currentStatus && currentStatus.val === false) {
      const msg = `<b>+++ ⚠️ Der ${instanceId} ist ausgestiegen! +++</b>`;

      // 1. Log warning
      console.warn(`[Adapter Monitor] ${msg}`);

      // 2. Dispatch notification
      sendGlobalNotify(msg, "System", 5);
    } else {
      console.log(`[Adapter Monitor] ✅ Entwarnung: ${instanceId} hat sich wieder gefangen`);
    }
  }, ALERT_DELAY_MS);

  pendingTimers.set(instanceId, timer);
});

// Lifecycle cleanup on script stop or restart
onStop((callback) => {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
  callback();
});
