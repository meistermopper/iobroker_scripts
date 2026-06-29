// =============================================================================
// DENON SURROUND-MANAGER v1.0
// Automatische Klangmodus-Wahl basierend auf Harmony Aktivitäten
// =============================================================================

const ID_DENON_MODE = "denon.0.settings.surroundMode";

// Mapping: Welche Aktivität bekommt welchen Modus?
// Benutze die Namen aus deinem Objekt (z.B. "STEREO", "DOLBY DIGITAL")
const SURROUND_MAPPING = {
  // --- VIDEO ---
  "harmony.0.Harmony_Wozi.activities.SAT_TV": "DOLBY DIGITAL",
  "harmony.0.Harmony_Wozi.activities.Bluray": "DOLBY DIGITAL",
  "harmony.0.Harmony_Wozi.activities.Chromecast_Video": "DOLBY DIGITAL",

  // --- AUDIO ---
  "harmony.0.Harmony_Wozi.activities.Online_Music": "STEREO",
  "harmony.0.Harmony_Wozi.activities.Plattenspieler": "STEREO",
  "harmony.0.Harmony_Wozi.activities.Chromecast_Musik": "STEREO",
};

const activityIds = Object.keys(SURROUND_MAPPING);

// --- LOGIK ---

on({ id: activityIds, change: "ne" }, (obj) => {
  // Status 2 = Aktivität wurde gestartet
  if (obj.state.val === 2) {
    const targetMode = SURROUND_MAPPING[obj.id];

    if (existsState(ID_DENON_MODE)) {
      // Wir bauen eine kleine Verzögerung von 2 Sekunden ein,
      // damit der Denon Zeit hat, den HDMI-Eingang zu verarbeiten,
      // bevor der Surround-Modus-Befehl kommt.
      setStateDelayed(ID_DENON_MODE, targetMode, 2000, true);

      //console.log(`[Multimedia] Aktivität "${obj.id}" gestartet. Denon wird auf ${targetMode} gesetzt.`);
    }
  }
});
