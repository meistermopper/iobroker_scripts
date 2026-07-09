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
 * Erstellt oder aktualisiert die benötigten Datenpunkte unter dem konfigurierten Stammverzeichnis (PATH).
 * Verwendet extendObject zur sicheren Erstellung mit Vordefinition der Metadaten.
 */
function init() {
  const states = [
    ["Anzahl", "number", "Anzahl Servicemeldungen", ""],
    ["Text", "string", "Servicemeldungen Text", ""],
    ["Firmware_Update", "boolean", "CCU Firmware Update verfügbar", ""],
  ];

  states.forEach(([id, type, name, unit]) => {
    /** @type {any} */
    const stateType = type;
    extendObject(`${PATH}.${id}`, {
      type: "state",
      common: {
        name: name,
        type: stateType,
        // Firmware-Update ist ein Wartungsindikator, die anderen sind reguläre Werte
        role: type === "boolean" ? "indicator.maintenance" : "value",
        read: true,
        write: false,
        unit: unit,
      },
      native: {},
    });
  });

  // Sicherstellen, dass die Datenpunkte unter 0_userdata.0.ccu existieren
  extendObject(ID_ONLINE_FW, {
    type: "state",
    common: {
      name: "Verfügbare CCU-Firmware",
      type: "string",
      role: "info.version",
      read: true,
      write: false,
    },
    native: {},
  });

  extendObject(ID_NEW_FW, {
    type: "state",
    common: {
      name: "Neue CCU Firmware verfügbar",
      type: "boolean",
      role: "indicator.maintenance",
      read: true,
      write: false,
    },
    native: {},
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
 * Hilfsfunktion zum Abrufen der Online-Version von den eQ-3 Servern als Promise.
 *
 * @returns {Promise<{err?: Error | null, response?: iobJS.httpResponse}>} Das Promise mit Fehler oder HTTP-Antwort.
 */
function fetchOnlineVersion() {
  const url =
    "https://ccu3-update.homematic.com/firmware/download?cmd=js_check_version&version=0.0.0&product=HM-CCU3&serial=0";
  return new Promise((resolve) => {
    httpGet(url, (err, response) => {
      resolve({ err, response });
    });
  });
}

/**
 * Holt die aktuelle CCU3-Firmwareversion von den offiziellen eQ-3 Update-Servern
 * und aktualisiert den Online-Firmware-Datenpunkt in ioBroker.
 *
 * @returns {Promise<void>}
 */
async function updateOnlineFirmwareVersion() {
  try {
    const { err, response } = await fetchOnlineVersion();
    if (err || !response || response.statusCode !== 200 || !response.data) {
      console.warn(
        `[Homematic Service-Zentrale] Fehler beim Abrufen der Online-Firmware: ${err || (response ? response.statusCode : "keine Antwort")}`,
      );
      return;
    }

    // eQ-3 API antwortet im Format: setLatestVersion('3.87.6.20260614', 'HM-CCU3')
    const match = response.data.match(/setLatestVersion\('([^']+)'/);
    if (match && match[1]) {
      const version = match[1];
      console.log(
        `[Homematic Service-Zentrale] Online-Firmware erfolgreich vom eQ-3 Server abgerufen: ${version}`,
      );
      if (existsState(ID_ONLINE_FW)) {
        await setStateAsync(ID_ONLINE_FW, version, true);
      }
    } else {
      console.warn(
        `[Homematic Service-Zentrale] Unerwartetes Antwortformat vom eQ-3 Update-Server: ${response.data}`,
      );
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

  // Nachricht für Telegram (HTML)
  const msg = `⚠️ <b>Homematic Servicemeldung</b>\n\nAktuelle Meldungen (${anzahl}):\n${text.replace(/<br>/g, "\n")}`;

  sendTo("telegram", "send", {
    text: msg,
    parse_mode: "HTML",
  });

  // Optional: Auch an Gotify senden (sofern ein Token hinterlegt ist)
  const token = getState("0_userdata.0.gotifytoken.iobroker")?.val;
  if (token) {
    const url = `https://mygotify.meistermopper.de/message?token=${token}`;
    const payload = {
      title: "HM Service",
      message: msg.replace(/<[^>]*>/g, ""), // HTML-Tags für Gotify entfernen
      priority: 1,
    };
    const options = { headers: { "Content-Type": "application/json" }, timeout: 10000 };
    // Native HTTP-POST Funktion von ioBroker
    httpPost(url, payload, options, (err) => {
      if (err) {
        console.error(`[Homematic Service-Zentrale] Gotify Fehler: ${err}`);
      }
    });
  }
});
