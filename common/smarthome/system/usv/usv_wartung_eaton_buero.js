/**
 * =============================================================================
 * SKRIPT: USV WARTUNG & KONDITIONIERUNG (BÜRO) - VERSION 41
 * =============================================================================
 * ZWECK:
 * Dieses Skript steuert die Akkupflege deiner USV. Es passt exakt zu deiner
 * VIS-Oberfläche mit 11 Steuerungspunkten.
 * * * FEATURES DIESER VERSION:
 * 1. PFAD: Alle Datenpunkte liegen unter 0_userdata.0.USV.Wartung.1.
 * 2. BROADCAST: Sprachausgabe an sayit.0, 2, 3, 4 und 5 (Google Home).
 * 3. WIFI-STABLE: Wartet 10 Sek. nach Stromausfall, bevor die erste Ansage kommt.
 * 4. SAFETY-EXIT: Schaltet beim Stoppen des Skripts sofort den Strom wieder an.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---

// Der neue, saubere Pfad für deine Datenpunkte
const dpPrefix = "0_userdata.0.USV.Wartung.1";

const upsNutPrefix = "nut.1"; // Pfad zum NUT-Adapter (Status der USV)
const sonoffPower = "alias.0.buero.usv.POWER"; // Pfad zum Aktor (Stromzufuhr USV)

// Verzögerung für die erste Ansage (WLAN-Stabilität nach Umschalt-Peak)
const wifiStabilizeDelay = 10000;

// Interne Hilfsvariablen
let lastSpokenSoc = -1; // Merkt sich den letzten angesagten SOC für die 5%-Bremse
let speakTimeout = null; // Timer-Variable für die verzögerte Sprachausgabe

// --- 2. INITIALISIERUNG DER 11 DATENPUNKTE ---

/**
 * Erzeugt alle Datenpunkte in 0_userdata.0, die du für deine VIS benötigst.
 */
async function initDP() {
  const states = [
    ["Minimum_Rest_Prozent", 35, "number", "Limit für Wartungs-Ende"],
    ["Minimum_Rest_Minuten", 10, "number", "Zeit-Limit"],
    ["Jetzt_Warten", false, "boolean", "Manueller Start-Knopf"],
    ["Automatische_Wartung_Aktiv", true, "boolean", "Zeitplan aktiv?"],
    ["Speak_bei_Wartung", true, "boolean", "Master-Schalter Sprache"],
    ["Speak_Prozent", false, "boolean", "Ansage in Prozent erlauben"],
    ["Speak_Minuten", true, "boolean", "Ansage in Minuten erlauben"],
    ["Speak_bei_Ausfall", true, "boolean", "Sprachwarnung bei echtem Ausfall"],
    ["Google_lautstaerke", 30, "number", "Lautstärke aller Google-Geräte"],
    ["Wartung_eingeleitet", false, "boolean", "Status-Flag: Wartung läuft"],
    ["Restlaufzeit_in_Minuten", 0, "number", "Anzeige für VIS"],
  ];

  for (const s of states) {
    const fullPath = `${dpPrefix}.${s[0]}`;
    if (!existsState(fullPath)) {
      /** @type {any} */
      const name = s[3];
      /** @type {any} */
      const type = s[2];

      await createStateAsync(fullPath, s[1], {
        name: name,
        type: type,
        role: "state",
      });
    }
  }
  console.log("USV-Wartung: Alle 11 Datenpunkte unter 0_userdata.0 erfolgreich initialisiert");
}

// --- 3. KOMMUNIKATIONS-FUNKTIONEN ---

// --- 4. WARTUNGS-AKTIONEN ---

/**
 * Startet die Wartung (Strom aus).
 */
async function startWartung(isManual = false) {
  setState(`${dpPrefix}.Wartung_eingeleitet`, true);
  lastSpokenSoc = -1; // Reset für sofortige erste Ansage
  setState(sonoffPower, false); // Trennung vom Netz
  sendGlobalNotify(
    isManual ? "Manuelle Wartung gestartet" : "Automatische Wartung gestartet",
    "USV Büro",
    1,
  );
}

/**
 * Beendet die Wartung (Strom an).
 */
async function stopWartung(reason = "") {
  setState(sonoffPower, true); // Wieder ans Netz
  setTimeout(() => {
    setState(`${dpPrefix}.Wartung_eingeleitet`, false);
    setState(`${dpPrefix}.Jetzt_Warten`, false);
  }, 15000);
  const soc = getState(`${upsNutPrefix}.battery.charge`)?.val;
  sendGlobalNotify(`Wartung beendet (${reason}), Stand: ${soc}%`, "USV Büro", 1);
}

// --- 5. TRIGGER-LOGIK ---

/**
 * ÜBERWACHUNG AKKUSTAND:
 * Regelt die automatische Abschaltung und die 5%-Sprech-Bremse.
 */
on({ id: `${upsNutPrefix}.battery.charge`, change: "ne" }, async (obj) => {
  const soc = obj.state.val;
  const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`)?.val;
  const onBattery = getState(`${upsNutPrefix}.status.onbattery`)?.val === true;
  const minSoc = getState(`${dpPrefix}.Minimum_Rest_Prozent`)?.val;

  // A: Automatischer Stopp bei Erreichen des Limits
  if (isWartung && soc <= minSoc) {
    await stopWartung(`Limit ${minSoc}% erreicht`);
    return;
  }

  // B: SPRACHSTEUERUNG
  if (onBattery) {
    // Prüfung: Soll bei diesem Ereignis überhaupt gesprochen werden?
    const canSpeak = isWartung
      ? getState(`${dpPrefix}.Speak_bei_Wartung`)?.val
      : getState(`${dpPrefix}.Speak_bei_Ausfall`)?.val;
    if (!canSpeak) return;

    // Nachtruhe nur bei geplanter Wartung, bei echtem Ausfall immer sprechen!
    const isDay = compareTime("08:00", "20:00", "between");
    const voiceVol = isWartung && !isDay ? null : getState(`${dpPrefix}.Google_lautstaerke`)?.val;

    // Modulo-Check: Sprechen bei Start, alle 5% oder kurz vor dem Ende
    if (lastSpokenSoc === -1 || (soc % 5 === 0 && soc !== lastSpokenSoc) || soc === minSoc + 2) {
      lastSpokenSoc = soc;
      const runtime = Math.floor(getState(`${dpPrefix}.Restlaufzeit_in_Minuten`)?.val);

      // Textbaustein nach deinen VIS-Einstellungen (Minuten vs Prozent)
      let text = isWartung ? "Wartung im Büro läuft, " : "Warnung, Stromausfall im Büro, ";

      const speakMin = getState(`${dpPrefix}.Speak_Minuten`)?.val;
      const speakPct = getState(`${dpPrefix}.Speak_Prozent`)?.val;

      if (speakMin) text += `Restlaufzeit ${runtime} Minuten, `;
      if (speakPct) text += `Akkustand ${soc} Prozent`;

      /**
       * DER WIFI-STABILISATOR:
       * Nach dem Umschalten auf Batterie kann das WLAN kurz zucken.
       * Wir verzögern die ERSTE Ansage (Akkustand noch hoch) um 10 Sek.
       */
      if (speakTimeout) clearTimeout(speakTimeout);

      if (soc >= 98) {
        console.log("USV-Audio: Warte 10s auf WLAN-Stabilität vor der ersten Ansage");
        speakTimeout = setTimeout(() => {
          sendGlobalNotify(text, "USV Büro", 5, voiceVol);
        }, wifiStabilizeDelay);
      } else {
        sendGlobalNotify(text, "USV Büro", 5, voiceVol);
      }
    }
  }
});

/**
 * ÜBERWACHUNG NETZSTATUS:
 * Erkennt den Wechsel zwischen Netz und Batterie.
 */
on({ id: `${upsNutPrefix}.status.onbattery`, change: "ne" }, async (obj) => {
  const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`)?.val;
  if (obj.state.val === true && !isWartung) {
    sendGlobalNotify("WARNUNG: Stromversorgung unterbrochen", "USV Büro", 8, 50); // Immer sprechen!
  } else if (obj.state.val === false) {
    if (speakTimeout) clearTimeout(speakTimeout);
    lastSpokenSoc = -1; // Reset für den nächsten Vorfall
    if (!isWartung) sendGlobalNotify("Netzspannung wiederhergestellt", "USV Büro", 1);
  }
});

// ZEITPLAN: Automatische Wartung (jeden 1. Montag alle 2 Monate um 11:00 Uhr)
schedule("0 11 1-7 */2 *", async () => {
  if (new Date().getDay() === 1) {
    // Prüfen ob es wirklich Montag ist
    const autoAktiv = getState(`${dpPrefix}.Automatische_Wartung_Aktiv`)?.val;
    const soc = getState(`${upsNutPrefix}.battery.charge`)?.val;

    if (autoAktiv && soc > 89) {
      await startWartung(false);
    }
  }
});

// VIS BUTTON-TRIGGER
on({ id: `${dpPrefix}.Jetzt_Warten`, change: "ne", val: true }, () => {
  startWartung(true);
});

// --- 6. SAFETY-STOP (SKRIPT-SCHUTZ) ---

/**
 * Verhindert, dass die USV auf Batterie bleibt, wenn du das Skript stoppst.
 */
onStop((callback) => {
  console.warn("USV-Safety: Skript-Stopp, erzwinge Netzbetrieb zur Sicherheit");
  setState(sonoffPower, true);
  setTimeout(callback, 500);
});

// START
initDP();
