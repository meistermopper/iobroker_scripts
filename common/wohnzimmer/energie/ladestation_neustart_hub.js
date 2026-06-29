// =============================================================================
// HARMONY-HUB RECOVERY v2.1 (AUTO-INIT & BOOT-LOOP PROTECTION)
// =============================================================================

// --- 1. KONFIGURATION ---
const HUB_CONNECTED = "harmony.0.Harmony_Wozi.hubConnected";
const POWER_SOCKET = "sonoff.0.Ladestation.POWER";
const PATH_STORAGE = "0_userdata.0.Energie.Harmony.";
const PATH_ACTIVITIES = "harmony.0.Harmony_Wozi.activities.";

const activityMapping = {
  bluray: "Bluray",
  chromecast_audio: "Chromecast_Musik",
  chromecast_video: "Chromecast_Video",
  online_musik: "Online_Music",
  phono: "Plattenspieler",
  sat_tv: "SAT_TV",
};

let isRecovering = false;

// --- 2. AUTO-INITIALISIERUNG ---
// Erstellt alle Speicher-Datenpunkte unter 0_userdata, falls sie fehlen.
function ensureHarmonyStates() {
  Object.keys(activityMapping).forEach((key) => {
    createState(PATH_STORAGE + key, false, {
      name: "Gespeicherter Status vor Reset: " + activityMapping[key],
      type: "boolean",
      role: "state",
    });
  });
}

// Sofort ausführen
ensureHarmonyStates();

// --- 3. LOGIK ---
on({ id: HUB_CONNECTED, change: "ne", ack: true }, (obj) => {
  // Fall A: Hub ist wieder da -> Sperre lösen
  if (obj.state.val === true && isRecovering) {
    isRecovering = false;
    console.log(
      "+++ Harmony Hub wieder verbunden. Recovery-Sperre aufgehoben. +++",
    );
    return;
  }

  // Fall B: Hub geht offline -> Recovery nach 30s "Gedenkzeit" starten
  if (obj.state.val === false && !isRecovering) {
    setTimeout(() => {
      if (getState(HUB_CONNECTED)?.val === false) {
        startHardReset();
      }
    }, 30000);
  }
});

async function startHardReset() {
  if (isRecovering) return;
  isRecovering = true;

  console.warn("Harmony Hub dauerhaft offline! Starte Hard-Reset-Sequenz...");

  // 1. Aktuelle Aktivitäten im RAM & 0_userdata sichern
  for (let key in activityMapping) {
    let state = getState(PATH_ACTIVITIES + activityMapping[key]);
    if (state) {
      setState(PATH_STORAGE + key, state.val, true);
    }
  }

  // 2. Strom-Zyklus (Aus -> 10s -> An)
  setState(POWER_SOCKET, false);

  setTimeout(() => {
    setState(POWER_SOCKET, true);
    console.log("Strom ist wieder an. Warte auf Bootvorgang (90s)...");

    // 3. Nach 90s Bootzeit: Aktivitäten basierend auf den sicheren Datenpunkten wiederherstellen
    setTimeout(() => {
      console.log("Stelle Aktivitäten wieder her...");
      let stagger = 0;
      for (let key in activityMapping) {
        let saved = getState(PATH_STORAGE + key);
        if (saved && saved.val === true) {
          setStateDelayed(
            PATH_ACTIVITIES + activityMapping[key],
            true,
            stagger,
          );
          stagger += 500;
        }
      }
      sendTo("telegram", "send", {
        text: "⚙️ Harmony-Hub: Reset durchgeführt & Aktivitäten wiederhergestellt.",
      });
    }, 90000);

    // 4. Sicherheits-Timeout: Falls Hub nie 'true' liefert (Fail-Safe nach 5 Min)
    setTimeout(() => {
      if (isRecovering) {
        isRecovering = false;
        console.warn("Recovery-Lock durch 5-Min-Timeout aufgehoben.");
      }
    }, 300000);
  }, 10000);
}
