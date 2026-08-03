/* eslint-env es2022 */
/**
 * Name:   Homematic Service-Zentrale (FIXED)
 * Zweck:  Überwacht Homematic-Hardwaremeldungen (UNREACH, LOWBAT, CONFIG_PENDING)
 *         sowie die Firmware der CCU-Zentrale und meldet Updates/Fehler per Telegram & Gotify.
 */

// --- KONFIGURATION ---

// Stamm-Datenpunktpfad in ioBroker, unter dem die Skript-Datenpunkte erstellt werden.
const PATH = "0_userdata.0.HM-Servicemeldungen";

// Datenpunkt der lokalen CCU-Firmware-Version (bereitgestellt durch den hm-rega Adapter).
const ID_LOCAL_FW = "hm-rega.0.PEQ1947872.0.FIRMWARE_VERSION";

// Datenpunkt zur Speicherung der aktuell im Internet verfügbaren CCU-Firmware-Version.
const ID_ONLINE_FW = "0_userdata.0.ccu.Verfuegbare_CCU-Firmware";

// Datenpunkt zur Speicherung der Verfügbarkeit einer neuen CCU-Firmware-Version (für VIS).
const ID_NEW_FW = "0_userdata.0.ccu.neue_ccu_firmware";

// jQuery-artige Selektoren zur Überwachung aller Homematic-Gerätekanäle.
// SelectorUNREACH: Findet alle Datenpunkte, die Verbindungsabbrüche signalisieren.
const SelectorUNREACH = $("channel[state.id=*.UNREACH]");
// SelectorLOWBAT: Findet alle Datenpunkte, die eine schwache Batterie melden.
const SelectorLOWBAT = $("channel[state.id=*.LOWBAT]");
// SelectorCONFIG: Findet alle Datenpunkte, bei denen noch Konfigurationsdaten übertragen werden müssen.
const SelectorCONFIG = $("channel[state.id=*.CONFIG_PENDING]");

// --- LOGIK ---

/**
 * 1. Initialisierung der Datenpunkte
 * Erstellt die benötigten Datenpunkte unter dem konfigurierten Stammverzeichnis (PATH), falls sie noch nicht existieren.
 * Verwendet createStateAsync zur sicheren Erstellung mit Vordefinition der Metadaten.
 */
async function init() {
  const states = [
    ["Anzahl", "number", "Anzahl Servicemeldungen", ""],
    ["Text", "string", "Servicemeldungen Text", ""],
    ["Firmware_Update", "boolean", "CCU Firmware Update verfügbar", ""],
  ];

  for (const [id, type, name, unit] of states) {
    /** @type {any} */
    const stateType = type;
    const defVal = type === "boolean" ? false : type === "number" ? 0 : "";
    await createStateAsync(`${PATH}.${id}`, defVal, {
      name: name,
      type: stateType,
      // Firmware-Update ist ein Wartungsindikator, die anderen sind reguläre Werte
      role: type === "boolean" ? "indicator.maintenance" : "value",
      read: true,
      write: false,
      unit: unit,
    });
  }

  // Sicherstellen, dass die Datenpunkte unter 0_userdata.0.ccu existieren
  await createStateAsync(ID_ONLINE_FW, "", {
    name: "Verfügbare CCU-Firmware",
    type: "string",
    role: "info.version",
    read: true,
    write: false,
  });

  await createStateAsync(ID_NEW_FW, false, {
    name: "Neue CCU Firmware verfügbar",
    type: "boolean",
    role: "indicator.maintenance",
    read: true,
    write: false,
  });
}

/**
 * Extrahiert eine Versionsnummer (Ziffern getrennt durch Punkte) aus einem String.
 * Filtert störende Texte oder Klammern wie "(3.87.6.20260614 verfügbar)" heraus,
 * um eine saubere Versionsnummer wie "3.87.6.20260614" zurückzugeben.
 *
 * @param {any} str - Der zu bereinigende String.
 * @returns {string} Die extrahierte Versionsnummer oder ein leerer String.
 */
function extractVersion(str) {
  const match = String(str).match(/\d+(?:\.\d+)+/);
  return match ? match[0] : "";
}

/**
 * Vergleicht zwei Versionsnummern semantisch.
 * Zerlegt die Versionsnummern in numerische Arrays und vergleicht sie Stelle für Stelle.
 * Gibt true zurück, wenn versionOnline neuer ist als versionLocal.
 *
 * @param {any} versionLocal - Die installierte lokale Version.
 * @param {any} versionOnline - Die im Internet verfügbare Version.
 * @returns {boolean} True, wenn ein Update vorliegt, andernfalls false.
 */
function isVersionNewer(versionLocal, versionOnline) {
  if (!versionLocal || !versionOnline) return false;

  const cleanLocal = extractVersion(versionLocal);
  const cleanOnline = extractVersion(versionOnline);

  if (!cleanLocal || !cleanOnline) return false;

  // Umwandlung in Arrays aus Zahlen (z. B. "3.85.7" -> [3, 85, 7])
  const localParts = cleanLocal.split(".").map((num) => parseInt(num, 10) || 0);
  const onlineParts = cleanOnline.split(".").map((num) => parseInt(num, 10) || 0);

  // Vergleich von links nach rechts (Major, Minor, Patch, Build)
  const maxLength = Math.max(localParts.length, onlineParts.length);
  for (let i = 0; i < maxLength; i++) {
    const localPart = localParts[i] || 0;
    const onlinePart = onlineParts[i] || 0;

    if (onlinePart > localPart) return true;
    if (onlinePart < localPart) return false;
  }

  return false;
}

/**
 * Hilfsfunktion zum Abrufen der Online-Version von den OpenCCU GitHub Releases als Promise.
 *
 * @returns {Promise<{err?: Error | null, response?: iobJS.httpResponse}>} Das Promise mit Fehler oder HTTP-Antwort.
 */
function fetchOnlineVersion() {
  const url = "https://api.github.com/repos/OpenCCU/OpenCCU/releases/latest";
  const options = {
    headers: {
      "User-Agent": "ioBroker-Script",
    },
  };
  return new Promise((resolve) => {
    httpGet(url, options, (err, response) => {
      resolve({ err, response });
    });
  });
}

/**
 * Holt die aktuelle OpenCCU-Firmwareversion von den offiziellen GitHub Releases
 * und aktualisiert den Online-Firmware-Datenpunkt in ioBroker.
 *
 * @returns {Promise<void>}
 */
async function updateOnlineFirmwareVersion() {
  try {
    const { err, response } = await fetchOnlineVersion();
    if (err || !response || response.statusCode !== 200 || !response.data) {
      console.warn(
        `[Homematic Service-Zentrale] Fehler beim Abrufen der Online-Firmware von GitHub: ${err || (response ? response.statusCode : "keine Antwort")}`,
      );
      return;
    }

    let releaseData;
    if (typeof response.data === "object") {
      releaseData = response.data;
    } else {
      try {
        releaseData = JSON.parse(response.data);
      } catch (e) {
        console.warn(`[Homematic Service-Zentrale] Fehler beim Parsen der GitHub-Antwort: ${e}`);
        return;
      }
    }

    if (releaseData?.tag_name) {
      const version = extractVersion(releaseData.tag_name);
      if (version) {
        //console.log(
        //  `[Homematic Service-Zentrale] Online-Firmware erfolgreich von GitHub abgerufen: ${version}`,
        //);
        if (existsState(ID_ONLINE_FW)) {
          await setStateAsync(ID_ONLINE_FW, version, true);
        }
      } else {
        console.warn(
          `[Homematic Service-Zentrale] Keine gültige Version in tag_name gefunden: ${releaseData.tag_name}`,
        );
      }
    } else {
      console.warn(`[Homematic Service-Zentrale] tag_name fehlt in GitHub-Antwort`);
    }
  } catch (error) {
    console.error(`[Homematic Service-Zentrale] Fehler beim Abrufen der CCU-Firmware: ${error}`);
  }
}

/**
 * Hauptprüffunktion.
 * Scant alle Homematic-Geräte nach Servicemeldungen (UNREACH, LOWBAT, CONFIG_PENDING),
 * vergleicht die installierte CCU-Firmware mit der Online-Version und
 * schreibt das Gesamtergebnis in die Datenpunkte.
 */
function checkHomematicService() {
  let anzahl = 0;
  const textList = [];

  // --- TEIL 1: Hardware-Meldungen scannen ---
  // Hilfsfunktion zur Verarbeitung der jQuery-Kanal-Selektoren
  function processSelector(selector) {
    selector.each((id) => {
      // Prüft ob der Datenpunkt existiert und den Zustand true (aktiv) aufweist
      if (existsState(id) && getState(id)?.val === true) {
        const obj = getObject(id);
        // Nutzt den Namen des Geräts aus den Metadaten falls vorhanden, sonst die ID
        const deviceName = obj?.common?.name ? obj.common.name : id;
        const type = id.split(".").pop();
        textList.push(`⚠️ <b>${deviceName}</b>: ${type}`);
        anzahl++;
      }
    });
  }

  // Auswertung für alle drei Meldungsklassen
  processSelector(SelectorUNREACH);
  processSelector(SelectorLOWBAT);
  processSelector(SelectorCONFIG);

  // --- TEIL 2: CCU-Firmware Vergleich ---
  const stateLocal = getState(ID_LOCAL_FW);
  const stateOnline = getState(ID_ONLINE_FW);
  let fwUpdate = false;

  // Führt den Vergleich nur durch, wenn beide Datenpunkte gültige Werte besitzen
  if (
    stateLocal &&
    stateOnline &&
    stateLocal.val !== null &&
    stateLocal.val !== undefined &&
    stateOnline.val !== null &&
    stateOnline.val !== undefined
  ) {
    console.debug(
      `[Homematic Service-Zentrale] CCU-Firmware Vergleich: Lokal="${stateLocal.val}", Online="${stateOnline.val}"`,
    );
    if (isVersionNewer(stateLocal.val, stateOnline.val)) {
      fwUpdate = true;
      textList.push(
        `🆕 <b>CCU Firmware</b>: Update verfügbar (${stateLocal.val} ➔ ${stateOnline.val})`,
      );
      anzahl++;
      console.log(
        `[Homematic Service-Zentrale] CCU-Firmware Update verfügbar: ${stateLocal.val} ➔ ${stateOnline.val}`,
      );
    }
  }

  // --- TEIL 3: Ergebnisse schreiben ---
  setState(`${PATH}.Firmware_Update`, fwUpdate, true);
  setState(ID_NEW_FW, fwUpdate, true);
  setState(`${PATH}.Anzahl`, anzahl, true);

  // Generierung des finalen Zustandstextes
  const finalBuffer = anzahl > 0 ? textList.join("<br>") : "keine Service-Meldungen vorhanden";
  setState(`${PATH}.Text`, finalBuffer, true);
}

// --- TRIGGER ---

// @ts-expect-error - Unterdrückt jQuery-Typkonflikte des javascript-Adapters
SelectorUNREACH.on(checkHomematicService);
// @ts-expect-error - Unterdrückt jQuery-Typkonflikte des javascript-Adapters
SelectorLOWBAT.on(checkHomematicService);
// @ts-expect-error - Unterdrückt jQuery-Typkonflikte des javascript-Adapters
SelectorCONFIG.on(checkHomematicService);

// Reagiert auf manuelle/externe Änderungen der lokalen oder online Firmwareversion
on({ id: [ID_LOCAL_FW, ID_ONLINE_FW], change: "ne" }, checkHomematicService);

// Zyklischer Check (Backup) alle 30 Minuten
schedule("*/30 * * * *", checkHomematicService);
// Täglich um 03:00 Uhr nachts die Online-Firmware-Version aktualisieren
schedule("0 3 * * *", updateOnlineFirmwareVersion);

// Start-Sequenz
init();
setTimeout(async () => {
  // Aktualisiert zuerst die verfügbare Online-Firmware und stößt danach den Hauptcheck an
  await updateOnlineFirmwareVersion();
  checkHomematicService();
}, 1000); // 1 Sekunde Verzögerung nach Skriptstart zum Einlesen aller Datenpunkte

// --- TELEGRAM & GOTIFY BENACHRICHTIGUNG ---
// Löst eine Benachrichtigung aus, wenn sich die Anzahl der Servicemeldungen erhöht
on({ id: `${PATH}.Anzahl`, change: "gt" }, (obj) => {
  const text = getState(`${PATH}.Text`)?.val;
  const anzahl = obj.state.val;

  const msg = `⚠️ <b>Homematic Servicemeldung</b>\n\nAktuelle Meldungen (${anzahl}):\n${text.replace(/<br>/g, "\n")}`;
  sendGlobalNotify(msg, "HM Service", 1);
});
