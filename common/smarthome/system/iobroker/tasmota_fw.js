/**
 * SKRIPT: Tasmota Firmware Checker & Notifier (Robust)
 * * BESCHREIBUNG:
 * Prüft täglich die aktuelle Tasmota-Release-Version auf GitHub.
 * Vergleicht diese mit den installierten Versionen deiner Sonoff-Geräte.
 * Bei Fehlern (z.B. Timeout) wird die Abfrage automatisch wiederholt.
 * * PARAMETER:
 * - Zeitplan: Täglich um 10:11 Uhr
 * - Timeout: 10.000 ms (10 Sekunden)
 * - Retries: 3 Versuche bei Fehlern
 */

const logging = true;
const idVersionInternet =
  "0_userdata.0.Servicemeldungen.Verfuegbare_Tasmota-Firmware";
const idGotifyToken = "0_userdata.0.gotifytoken.iobroker";
const maxRetries = 3; // Maximale Anzahl der Versuche bei Fehlern

async function checkTasmotaVersion(retryCount = 0) {
  const url = "https://api.github.com/repos/arendst/Tasmota/releases/latest";

  if (logging && retryCount > 0)
    console.log(
      `Tasmota: Wiederholung der Abfrage... (Versuch ${retryCount + 1}/${maxRetries})`,
    );

  // Abfrage starten mit erhöhtem Timeout
  httpGet(
    url,
    {
      headers: { "User-Agent": "ioBroker" },
      timeout: 10000, // Erhöht auf 10 Sekunden
    },
    async (err, response) => {
      // --- FEHLERABFANG ---
      if (err || !response || response.statusCode !== 200) {
        const errorMsg = err
          ? err.message
          : response
            ? `Status ${response.statusCode}`
            : "Keine Antwort";

        if (retryCount < maxRetries - 1) {
          console.warn(
            `Tasmota: Fehler beim Abruf (${errorMsg}). Erneuter Versuch in 60 Sekunden...`,
          );
          setTimeout(() => checkTasmotaVersion(retryCount + 1), 60000); // Nach 1 Minute erneut versuchen
        } else {
          console.error(
            `Tasmota: GitHub konnte nach ${maxRetries} Versuchen nicht erreicht werden. Abbruch.`,
          );
        }
        return;
      }

      try {
        // --- DATENVERARBEITUNG ---
        const data = JSON.parse(response.data);
        const latestFullVersion =
          data.tag_name.replace(/v/i, "").trim() + "(release-tasmota)";

        const stateLastKnown = await getStateAsync(idVersionInternet);
        const lastKnownVersion = stateLastKnown ? stateLastKnown.val : "";

        let updateDevices = [];
        // Suche alle Sonoff-Geräte mit dem Info1_Version Datenpunkt
        const tasmotaStates = $("channel[state.id=sonoff.0.*.Info1_Version]");

        tasmotaStates.each((id) => {
          const stateVal = getState(id).val;
          if (!stateVal) return; // Überspringen, falls leer

          const installed = stateVal
            .replace(/\((sonoff|tasmota)\)/gi, "")
            .trim();
          const deviceRoot = id.substring(0, id.lastIndexOf("."));

          const hostState = getState(deviceRoot + ".Info2_Hostname");
          const hostName =
            hostState && hostState.val ? hostState.val : "Unbekannt";

          // Vergleich (Version ohne Suffix)
          if (
            installed !==
            latestFullVersion.replace("(release-tasmota)", "").trim()
          ) {
            updateDevices.push(`${hostName} (ist: ${installed})`);
          }
        });

        // --- MELDUNG VERSENDEN ---
        // Nur wenn Version neu ODER Geräte noch nicht aktualisiert
        if (
          latestFullVersion !== lastKnownVersion &&
          updateDevices.length > 0
        ) {
          const message = `🆕 Tasmota Firmware vorhanden!\nVersion: ${latestFullVersion}\n\nBetroffene Geräte:\n${updateDevices.join("\n")}`;

          // Internet-Stand aktualisieren
          await setStateAsync(idVersionInternet, latestFullVersion, true);

          // Telegram
          sendTo("telegram", "send", { text: message });

          // Gotify
          const tokenState = await getStateAsync(idGotifyToken);
          if (tokenState && tokenState.val) {
            const command = `curl "https://mygotify.meistermopper.de/message?token=${tokenState.val}" -F "title=Tasmota Update" -F "message=${message}" -F "priority=1"`;
            exec(command);
          }

          if (logging)
            console.warn(
              `Tasmota: Update-Meldung versendet für ${updateDevices.length} Geräte.`,
            );
        } else if (logging) {
          console.log(
            `Tasmota: Check beendet. System ist auf dem neuesten Stand (${latestFullVersion}).`,
          );
        }
      } catch (parseError) {
        console.error(
          `Tasmota: Fehler beim Verarbeiten der JSON-Daten: ${parseError}`,
        );
      }
    },
  );
}

// Zeitplan: Täglich um 10:11 Uhr
schedule("11 10 * * *", () => checkTasmotaVersion());

// Manueller Start beim Skriptstart
checkTasmotaVersion();
