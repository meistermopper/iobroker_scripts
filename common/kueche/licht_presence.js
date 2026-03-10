/**
 * =============================================================================
 * KÜCHEN-LICHTSTEUERUNG v2.2 (PRESENCE FOLLOWER)
 * =============================================================================
 * ZWECK: Licht folgt dem Präsenzmelder unter Berücksichtigung von Helligkeit
 * und Tageszeit (Tag/Nacht-Modus).
 * * OPTIMIERUNGEN:
 * 1. TRAFFIC-FILTER: Sendet nur Schaltbefehle, wenn der Ist-Zustand abweicht.
 * 2. FUNK-SCHONUNG: 300ms Versatz zwischen Sonoff und Hue zur Lastverteilung.
 * 3. LOGIK: Direkte Umsetzung des Präsenzstatus ohne künstliche Nachlaufzeit.
 * 4. ÄNDERUNG v2.2: Bewegungsautomatik entfernt (Steuerung dauerhaft aktiv).
 * =============================================================================
 */

// --- 1. KONFIGURATION (DATENPUNKTE) ---
const IDS = {
  präsenz: "alias.0.kueche.bwm.PRESENCE_DETECTION_STATE",
  helligkeit: "alias.0.kueche.bwm.ILLUMINATION",
  spots_sonoff: "alias.0.kueche.licht.spots.POWER",
  hue_command: "alias.0.kueche.kuechenlampe.command",
};

// --- PARAMETER ---
const LIMIT_LUX = 12; // Schwelle für Aktivierung (nur wenn dunkler als 12 Lux)
const BRI_TAG = 254; // Helligkeit am Tag (Maximum)
const BRI_NACHT = 150; // Helligkeit in der Nacht (Gedimmt)

let debounceTimer = null; // Timer zur Entprellung des Eingangssignals

// --- 2. HAUPT-LOGIK ---
on({ id: IDS.präsenz, change: "ne" }, (obj) => {
  // Falls der Melder extrem schnell flackert, fängt dieser Timer das ab (50ms)
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    // --- WERTE ERFASSEN ---
    const istPräsent = !!obj.state.val; // Echter Boolean (true/false)
    const lux = getState(IDS.helligkeit).val;
    const spotsSindAn = getState(IDS.spots_sonoff).val;

    // Zeitprüfung: 22:00 bis 05:00 Uhr (ioBroker interne Funktion)
    const istNacht = compareTime("22:00", "05:00", "between");

    // FALL A: PRÄSENZ ERKANNT & ZU DUNKEL
    if (istPräsent && lux < LIMIT_LUX) {
      if (istNacht) {
        /**
         * NACHT-MODUS (22:00 - 05:00 Uhr)
         * Wir schalten nur die Hue-Lampe gedimmt an. Die Spots bleiben aus.
         */
        const cmdNacht = JSON.stringify({
          on: true,
          bri: BRI_NACHT,
          transitiontime: 10,
        });

        // Nur senden, wenn sich der Befehl vom aktuellen Status unterscheidet
        if (getState(IDS.hue_command).val !== cmdNacht) {
          setState(IDS.hue_command, cmdNacht);
        }
      } else {
        /**
         * TAG-MODUS (05:00 - 22:00 Uhr)
         * Erst Sonoff-Spots, dann Hue (mit 300ms Versatz zur Funk-Entlastung).
         */
        if (!spotsSindAn) {
          setState(IDS.spots_sonoff, true);
        }

        setTimeout(() => {
          const cmdTag = JSON.stringify({
            on: true,
            bri: BRI_TAG,
            transitiontime: 10,
          });
          if (getState(IDS.hue_command).val !== cmdTag) {
            setState(IDS.hue_command, cmdTag);
          }
        }, 300);
      }
    }

    // FALL B: PRÄSENZ BEENDET (Melder meldet 'false')
    else if (!istPräsent) {
      /**
       * ALLES AUSSCHALTEN
       * Wir schalten beide Kreise ab, falls sie noch an sind.
       */
      if (spotsSindAn) {
        setState(IDS.spots_sonoff, false);
      }

      setTimeout(() => {
        const cmdAus = JSON.stringify({ on: false, transitiontime: 10 });
        // Wir senden das "Aus", um sicherzugehen, dass die Bridge den Status kennt
        setState(IDS.hue_command, cmdAus);
      }, 300);
    }
  }, 50); // Signal-Stabilisierung
});
