/* eslint-env es2022 */
/**
 * =============================================================================
 * POSTKASTEN-MONITOR v2.4.2
 * =============================================================================
 * ZWECK: Überwachung des Briefkastens mit Sprachausgabe und VIS-Status.
 * FIX: VIS-Datenpunkt wird nun auch tagsüber korrekt auf "true" gesetzt.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const _WARTEZEIT_RESUME_MS = 8000; // Zeit bis Musik nach Ansage weiterläuft
const POSTKASTEN_STATE_ID = "alias.0.draussen.postkasten.STATE";
const POSTKASTEN_VIS_ID = "0_userdata.0.Haushalt.Briefkasten";

// Sperren zur Vermeidung von Mehrfach-Meldungen innerhalb einer Minute
let Sperre = false;
let _Sperre_stumm = false;

/**
 * --- 3. TRIGGER: POST IST DA ---
 * Reagiert auf den Hardware-Sensor am Briefkasten.
 */
on({ id: POSTKASTEN_STATE_ID, change: "ne" }, async (obj) => {
  // Sicherheits-Check: Nur reagieren, wenn Sensor "wahr" meldet
  if (!obj.state?.val) return;

  // Wenn in der VIS der Kasten noch als "voll" (true) markiert ist, nichts tun
  if (getState(POSTKASTEN_VIS_ID)?.val === true) return;

  const msgText = "📫 Es war gerade jemand am Postkasten.";

  // FALL A: Tagsüber (08:00 - 20:00 Uhr) -> Volles Programm mit Ansage
  if (!Sperre && compareTime("08:00", "20:00", "between", null)) {
    Sperre = true;
    console.log("Postkasten: Ereignis erkannt, starte Ansage & VIS-Update");
    setState(POSTKASTEN_VIS_ID, true);
    await sendGlobalNotify(msgText, "", 1, 40); // Sprachausgabe mit Lautstärke 40

    setTimeout(() => {
      _Sperre_stumm = false;
    }, 60000);
  }
});

/**
 * --- 4. TRIGGER: SCHARFSCHALTUNG NACH LEERUNG ---
 * Reagiert, wenn Du in der VIS das Paket-Symbol anklickst (Status wird false).
 */
on({ id: POSTKASTEN_VIS_ID, change: "ne" }, async (obj) => {
  // Wir reagieren nur auf den Wechsel von "Voll" (true) zu "Geleert" (false)
  if (obj.state.val === false) {
    sendGlobalNotify("📪 Der Briefkasten wurde wieder scharfgeschaltet.", "", 1);
    console.log("Postkasten: System manuell zurückgesetzt");
  }
});
