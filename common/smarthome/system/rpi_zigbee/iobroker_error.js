// =============================================================================
// HOST-WATCHER v1.0 (rpizigbee Monitor)
// =============================================================================

const ID_HOST_ALIVE = "system.host.rpizigbee.alive";
const WATCH_TIME = 300000; // 5 Minuten in Millisekunden

let watchdogTimer = null;
let wasReportedDown = false; // Merker, damit wir wissen, ob wir eine "Wieder da"-Meldung brauchen

// --- LOGIK ---

on({ id: ID_HOST_ALIVE, change: "ne" }, (obj) => {
  const alive = obj.state.val;

  if (!alive) {
    // FALL: Host geht OFFLINE
    console.log(
      `[Watchdog] rpizigbee ist offline. Starte ${WATCH_TIME / 60000}min Timer...`,
    );

    // Timer starten
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      sendTo("telegram", "send", {
        text: "+++ ❌ ioBroker Zigbee ist down! +++",
      });
      console.error("[Watchdog] Alarm: rpizigbee ist seit 5 Minuten down!");

      wasReportedDown = true;
      watchdogTimer = null;
    }, WATCH_TIME);
  } else {
    // FALL: Host ist ONLINE
    if (watchdogTimer) {
      // Host kam innerhalb der 5 Minuten zurück
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
      console.log(
        "[Watchdog] rpizigbee ist wieder da (innerhalb des Zeitlimits).",
      );
    }

    if (wasReportedDown) {
      // Host war bereits als "Down" gemeldet und ist nun wieder da
      sendTo("telegram", "send", {
        text: "+++ ✅ ioBroker Zigbee läuft wieder. +++",
      });
      console.log("[Watchdog] Entwarnung: rpizigbee ist wieder online.");
      wasReportedDown = false;
    }
  }
});
