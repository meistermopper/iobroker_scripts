/**
 * =============================================================================
 * SKRIPT: USV WARTUNG & KONDITIONIERUNG (SERVERSCHRANK) - VERSION 41.1
 * =============================================================================
 * ZWECK:
 * Akkupflege der APC-USV im Serverschrank.
 * * FEATURES DIESER VERSION:
 * 1. PFAD: Datenpunkte unter 0_userdata.0.USV.Wartung.0 (Instanz 0).
 * 2. APC-LOGIK: Umrechnung von Sekunden in Minuten unter Abzug von "Runtime-Low".
 * 3. WIFI-STABLE: 10 Sek. Verzögerung vor der ersten Ansage zur Netzstabilisierung.
 * 4. BROADCAST: Sprachausgabe an sayit.0, 2, 3, 4 und 5.
 * 5. SAFETY-STOP: Schaltet beim Skript-Stopp sofort den Strom wieder an.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---

// Neuer Pfad für die Datenpunkte (Instanz 0 für Serverschrank)
const dpPrefix = "0_userdata.0.USV.Wartung.0";

const upsNutPrefix = "nut.0"; // NUT-Pfad für die APC-USV
const sonoffPower = "sonoff.0.Serverschrank.POWER"; // Zuleitung Serverschrank
const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker").val;

// Liste der Google-Instanzen für den Haus-weiten Alarm
const sayitInstances = ["sayit.0", "sayit.2", "sayit.3", "sayit.4", "sayit.5"];

// Verzögerung für die erste Ansage (WLAN-Stabilität)
const wifiStabilizeDelay = 10000;

// Hilfsvariablen für die Steuerung
let lastSpokenSoc = -1; // Merker für die 5%-Sprechbremse
let speakTimeout = null; // Speicher für den Verzögerungs-Timer

// --- 2. INITIALISIERUNG ---

/**
 * Erzeugt alle 11 Datenpunkte in 0_userdata.0 für deine VIS-Oberfläche.
 */
async function initDP() {
  const states = [
    ["Minimum_Rest_Prozent", 35, "number", "Akkustand für Wartungs-Ende"],
    ["Minimum_Rest_Minuten", 10, "number", "Zeit-Limit für Abschaltung"],
    ["Jetzt_Warten", false, "boolean", "Manueller Start-Button"],
    ["Automatische_Wartung_Aktiv", true, "boolean", "Zeitplan aktiv?"],
    ["Speak_bei_Wartung", true, "boolean", "Master-Schalter Sprache"],
    ["Speak_Prozent", false, "boolean", "Ansage in % erlauben"],
    ["Speak_Minuten", true, "boolean", "Ansage in Min erlauben"],
    ["Speak_bei_Ausfall", true, "boolean", "Sprachwarnung bei Notfall"],
    ["Google_lautstaerke", 30, "number", "Lautstärke Google Geräte"],
    ["Wartung_eingeleitet", false, "boolean", "Status: Wartung läuft"],
    ["Restlaufzeit_in_Minuten", 0, "number", "Anzeige für VIS"],
  ];

  for (const s of states) {
    const fullPath = `${dpPrefix}.${s[0]}`;
    if (!existsState(fullPath)) {
      await createStateAsync(fullPath, s[1], {
        name: s[3],
        type: s[2],
        role: "state",
      });
    }
  }
  console.log(
    "[USV-APC] Datenpunkte unter 0_userdata.0 erfolgreich initialisiert.",
  );
}

// --- 3. KOMMUNIKATION ---

function notify(text, priority = 5) {
  const header = "🔌🔋 USV Serverschrank\n\n";
  sendTo("telegram", "send", { text: header + text });
  console.log(`USV-APC-Log: ${text}`);
  exec(
    `curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=USV Serverschrank" -F "message=${text}" -F "priority=${priority}"`,
  );
}

/**
 * Verteilt die Ansage an alle Google-Geräte im Haus.
 */
function speak(text) {
  if (!getState(`${dpPrefix}.Speak_bei_Wartung`).val) return;
  const vol = getState(`${dpPrefix}.Google_lautstaerke`).val;

  sayitInstances.forEach((instance) => {
    sendTo(instance, "say", { text: `${vol}; ${text}`, volume: vol });
  });
  console.log(
    `[USV-APC-Audio] Broadcast an ${sayitInstances.length} Lautsprecher gesendet.`,
  );
}

// --- 4. AKTIONEN ---

async function startWartung(isManual = false) {
  setState(`${dpPrefix}.Wartung_eingeleitet`, true);
  lastSpokenSoc = -1; // Reset für sofortigen Start der Ansage-Kette
  setState(sonoffPower, false); // Netzspannung kappen
  notify(
    isManual
      ? "Manuelle Wartung Serverschrank gestartet."
      : "Automatische Wartung Serverschrank gestartet.",
  );
}

async function stopWartung(reason = "") {
  setState(sonoffPower, true); // Strom wieder an
  setTimeout(() => {
    setState(`${dpPrefix}.Wartung_eingeleitet`, false);
    setState(`${dpPrefix}.Jetzt_Warten`, false);
  }, 15000);
  const soc = getState(`${upsNutPrefix}.battery.charge`).val;
  notify(`Wartung Serverschrank beendet (${reason}). Stand: ${soc}%.`);
}

// --- 5. TRIGGER & EVENT-STEUERUNG ---

/**
 * TRIGGER: Überwachung Akkustand (battery.charge)
 * Hier wird das Ende der Wartung und die Sprech-Bremse geregelt.
 */
on({ id: `${upsNutPrefix}.battery.charge`, change: "ne" }, async (obj) => {
  const soc = obj.state.val;
  const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`).val;
  const onBattery = getState(`${upsNutPrefix}.status.onbattery`).val === true;
  const minSoc = getState(`${dpPrefix}.Minimum_Rest_Prozent`).val;
  const minMin = getState(`${dpPrefix}.Minimum_Rest_Minuten`).val;
  const runtime = getState(`${dpPrefix}.Restlaufzeit_in_Minuten`).val;

  // A: Automatisches Ende bei Erreichen der Sicherheitslimits
  if (isWartung && (soc <= minSoc || runtime <= minMin)) {
    await stopWartung(`Limit (${soc}% / ${Math.floor(runtime)} min) erreicht`);
    return;
  }

  // B: INTELLIGENTE SPRACHAUSGABE
  if (onBattery) {
    // Prüfung: Soll laut VIS überhaupt gesprochen werden?
    const canSpeak = isWartung
      ? getState(`${dpPrefix}.Speak_bei_Wartung`).val
      : getState(`${dpPrefix}.Speak_bei_Ausfall`).val;
    if (!canSpeak) return;

    // Sprech-Bremse: Nur bei 5%-Schritten oder kurz vor dem Limit
    if (
      lastSpokenSoc === -1 ||
      (soc % 5 === 0 && soc !== lastSpokenSoc) ||
      soc === minSoc + 2
    ) {
      lastSpokenSoc = soc;

      let text = isWartung
        ? "U S V Wartung Serverschrank läuft. "
        : "Warnung. Stromversorgung Serverschrank unterbrochen. ";
      if (getState(`${dpPrefix}.Speak_Minuten`).val)
        text += `Restlaufzeit ${Math.floor(runtime)} Minuten. `;
      if (getState(`${dpPrefix}.Speak_Prozent`).val)
        text += `Akkustand ${soc} Prozent.`;

      // WIFI-STABILISATOR: Bei der ersten Ansage (nahe 100%) verzögern
      if (speakTimeout) clearTimeout(speakTimeout);
      if (soc >= 98) {
        console.log("[USV-APC-Audio] Warte 10s auf WLAN-Stabilität...");
        speakTimeout = setTimeout(() => {
          speak(text);
        }, wifiStabilizeDelay);
      } else {
        speak(text);
      }
    }
  }
});

/**
 * TRIGGER: Netzstatus (onbattery)
 * Erkennt den Wechsel zwischen Netz und Batterie.
 */
on({ id: `${upsNutPrefix}.status.onbattery`, change: "ne" }, async (obj) => {
  const isWartung = getState(`${dpPrefix}.Wartung_eingeleitet`).val;
  if (obj.state.val === true && !isWartung) {
    notify(
      "⚠️ WARNUNG: Stromversorgung Serverschrank unerwartet unterbrochen!",
      8,
    );
  } else if (obj.state.val === false) {
    if (speakTimeout) clearTimeout(speakTimeout);
    lastSpokenSoc = -1; // Reset für den nächsten Vorfall
    if (!isWartung) notify("✅ Netzspannung Serverschrank wiederhergestellt.");
  }
});

/**
 * TRIGGER: Restzeit-Umrechnung (APC Spezifisch)
 * Wandelt Sekunden in Minuten um und zieht die "Runtime-Low" Grenze ab.
 */
on({ id: `${upsNutPrefix}.battery.runtime`, change: "ne" }, (obj) => {
  const runtimeSec = obj.state.val;
  const runtimeLow = getState(`${upsNutPrefix}.battery.runtime-low`).val || 0;

  // Formel: (Sekunden - Puffer) / 60
  const realMinutes = (runtimeSec - runtimeLow) / 60;

  setState(`${dpPrefix}.Restlaufzeit_in_Minuten`, realMinutes, true);
});

// ZEITPLAN: Automatische Wartung (jeden 1. Montag alle 2 Monate)
schedule("0 11 1-7 */2 *", async () => {
  if (new Date().getDay() === 1) {
    const autoAktiv = getState(`${dpPrefix}.Automatische_Wartung_Aktiv`).val;
    const soc = getState(`${upsNutPrefix}.battery.charge`).val;
    if (autoAktiv && soc > 89) await startWartung(false);
  }
});

// VIS BUTTON
on({ id: `${dpPrefix}.Jetzt_Warten`, change: "ne", val: true }, () => {
  startWartung(true);
});

// --- 6. SAFETY-STOP (AIRBAG) ---

/**
 * Stellt sicher, dass die USV wieder Saft bekommt, wenn das Skript beendet wird.
 */
onStop(function (callback) {
  console.warn("[USV-APC-Safety] Skript-Stopp! Erzwinge Netzbetrieb...");
  setState(sonoffPower, true);
  setTimeout(callback, 500);
});

// START
initDP();
