/* eslint-env es2022 */
/**
 * Name:   DrayTek Vigor 166 Online-Status (Nativer Webhook)
 * Zweck:  Erstellt die Datenpunkte und startet einen eigenen HTTP-Server
 *         für Grafana-Alerts mit konfigurierbaren Benachrichtigungskanälen.
 */

const http = require("node:http");

// --- KONFIGURATION ---
const HTTP_PORT = 8088; // Port, auf dem das Skript für Grafana lauscht
const DP_CONNECTED = "0_userdata.0.Vigor166.connected"; // Ziel-Datenpunkt für den Verbindungsstatus
const DP_PAYLOAD = "0_userdata.0.Vigor166.grafana_payload"; // Datenpunkt zur Sicherung des Roh-Payloads

// Benachrichtigungen (Kanäle einzeln aktivierbar/deaktivierbar)
const NOTIFY_TELEGRAM = true; // Telegram-Benachrichtigungen über dieses Skript senden
const NOTIFY_GOTIFY = true; // Gotify-Benachrichtigungen über dieses Skript senden
const NOTIFY_VOICE = true; // Sprachansage über Google Speaker (SayIt) senden
const NOTIFY_TITLE = "DrayTek Vigor 166"; // Standardtitel für die Messenger-Benachrichtigungen
const VOICE_VOLUME = 50; // Lautstärke der Sprachansage (null/0 = deaktiviert)

// --- LOGIK ---

// --- DATENPUNKTE AUTOMATISCH ERSTELLEN ---

// Erstellung des Online-Status-Datenpunktes (Typ: Boolean)
createState(DP_CONNECTED, true, {
  name: "DrayTek Vigor 166 Online-Status",
  desc: "Verbindungsstatus gesteuert durch Grafana Alerts (true = Connected, false = Disconnected)",
  type: "boolean",
  role: "indicator.connected",
  read: true,
  write: true,
  def: true,
});

// Erstellung des Datenpunktes zur Speicherung des letzten rohen Webhook-Inhalts von Grafana
createState(DP_PAYLOAD, "", {
  name: "Grafana Alert Raw Payload",
  desc: "Empfängt den ungeschnittenen Webhook-Payload von Grafana",
  type: "string",
  role: "json",
  read: true,
  write: true,
  def: "",
});

// --- HELPER FÜR BENACHRICHTIGUNGEN ---

/**
 * Sendet Benachrichtigungen über die konfigurierten Kanäle (Telegram, Gotify, SayIt).
 * @param {string} text - Der auszugebende/zu sendende Text
 * @param {number} priority - Dringlichkeit der Nachricht (besonders relevant für Gotify)
 */
function sendNotification(text, priority) {
  // 1. Telegram-Benachrichtigung senden (falls in Konfiguration aktiviert)
  if (NOTIFY_TELEGRAM) {
    sendTo("telegram", "send", {
      text: `[${NOTIFY_TITLE}] ${text}`,
    });
  }

  // 2. Gotify-Push-Benachrichtigung senden (falls in Konfiguration aktiviert)
  if (NOTIFY_GOTIFY) {
    // Sicheres Auslesen des Gotify-Tokens aus dem vordefinierten iobroker-Datenpunkt
    const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker")?.val;
    if (gotifyToken) {
      const url = `https://mygotify.meistermopper.de/message?token=${gotifyToken}`;
      const cleanText = text.replace(/<\/?[^>]+(>|$)/g, ""); // HTML-Tags entfernen für reinen Text
      const payload = { title: NOTIFY_TITLE, message: cleanText, priority: priority };

      // Native ioBroker httpPost-Funktion zur Übertragung nutzen
      httpPost(url, payload, { timeout: 5000 }, (error) => {
        if (error) console.error(`[Grafana-Vigor] Gotify Fehler: ${error}`);
      });
    }
  }

  // 3. Sprachausgabe (SayIt) via Google Speaker auslösen (falls aktiviert und Lautstärke > 0)
  if (NOTIFY_VOICE && VOICE_VOLUME !== null && VOICE_VOLUME > 0) {
    const voiceText = text
      .replace(/\p{Extended_Pictographic}/gu, "") // Emojis und Symbole entfernen, um Vorlesefehler zu vermeiden
      .replace(/\s\s+/g, " ") // Doppelte Leerzeichen bereinigen
      .trim();

    sendTo("sayit", "say", { text: voiceText, volume: VOICE_VOLUME });
  }
}

// --- EIGENER HTTP-WEBHOOK-SERVER ---

// Lokalen Webserver instanziieren, der auf Webhooks von Grafana reagiert
const server = http.createServer((req, res) => {
  // Nur POST-Anfragen verarbeiten, da Grafana Alerts per POST sendet
  if (req.method === "POST") {
    let body = "";

    // Datenströme (Chunks) sammeln und zusammensetzen
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    // Nach vollständigem Empfang des Payloads verarbeiten
    req.on("end", () => {
      // Rohen Payload zur Diagnose in den dafür vorgesehenen Datenpunkt schreiben
      setState(DP_PAYLOAD, body, true);

      try {
        const payload = JSON.parse(body);

        // Prüfen, ob der Payload einen gültigen Status enthält
        if (payload?.status) {
          // 1. Test-Alerts abfangen (Grafana-Funktion "Test" am Kontaktpunkt)
          const isTestAlert = payload.alerts?.some(
            (alert) => alert.labels?.alertname === "TestAlert",
          );
          if (isTestAlert) {
            console.log("[Grafana-Vigor] Test-Alert empfangen. Keine Statusänderung vorgenommen.");
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Test-Alert OK");
            return;
          }

          // 2. Alert-Typen identifizieren
          // Prüft, ob einer der Alarme im Payload einen Verbindungsabbruch betrifft (Disconnect oder Vigor 166 im Namen)
          const isDslDisconnect = payload.alerts?.some(
            (alert) =>
              alert.labels?.alertname?.toLowerCase()?.includes("disconnect") ||
              alert.labels?.alertname?.toLowerCase()?.includes("vigor 166"),
          );

          // Prüft, ob einer der Alarme ein SNR (Signal-to-Noise Ratio / Signal-Rausch-Toleranz) Problem meldet
          const isSnrWarning = payload.alerts?.some((alert) =>
            alert.labels?.alertname?.toLowerCase()?.includes("snr"),
          );

          // 3. Statusauswertung & gezielte Benachrichtigungen

          // Fall A: Alarm wird ausgelöst (status === "firing")
          if (payload.status === "firing") {
            if (isDslDisconnect) {
              setState(DP_CONNECTED, false, true); // Status auf "Offline/Disconnected" setzen
              console.warn(
                `[Grafana-Vigor] Alarm FIRING (Disconnect) -> Status '${DP_CONNECTED}' auf FALSE gesetzt.`,
              );
              sendNotification(
                "Achtung: Die DSL-Verbindung über den DrayTek Vigor 166 wurde getrennt!",
                5, // Gotify-Prio: Warnung
              );
            } else if (isSnrWarning) {
              console.warn("[Grafana-Vigor] Alarm FIRING (Low SNR Warning).");
              sendNotification(
                "Warnung: Die Signal-Rausch-Toleranz der DSL-Leitung ist kritisch niedrig!",
                4, // Gotify-Prio: Warnung
              );
            } else {
              console.log("[Grafana-Vigor] Ignoriert: Unbekannter FIRING Alert.");
            }

            // Fall B: Alarm wurde wieder gelöst (status === "resolved")
          } else if (payload.status === "resolved") {
            if (isDslDisconnect) {
              setState(DP_CONNECTED, true, true); // Status auf "Online/Connected" setzen
              console.log(
                `[Grafana-Vigor] Alarm RESOLVED (Disconnect) -> Status '${DP_CONNECTED}' auf TRUE gesetzt.`,
              );
              sendNotification(
                "Entwarnung: Der DrayTek Vigor 166 ist wieder online!",
                1, // Gotify-Prio: Info
              );
            } else if (isSnrWarning) {
              console.log("[Grafana-Vigor] Alarm RESOLVED (Low SNR Warning).");
              sendNotification(
                "Entwarnung: Die Signal-Rausch-Toleranz der DSL-Leitung ist wieder stabil.",
                1, // Gotify-Prio: Info
              );
            } else {
              console.log("[Grafana-Vigor] Ignoriert: Unbekannter RESOLVED Alert.");
            }
          }
        }

        // Antwort an Grafana senden, dass der Webhook erfolgreich empfangen wurde
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      } catch (error) {
        console.error(`[Grafana-Vigor] Fehler beim Verarbeiten des Webhooks: ${error}`);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
      }
    });
  } else {
    // Methoden ungleich POST ablehnen
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
  }
});

// Server auf gewähltem Port starten
server.listen(HTTP_PORT, () => {
  console.log(`[Grafana-Vigor] Webhook-Server lauscht auf Port ${HTTP_PORT}`);
});

// Bei Skript-Stopp den HTTP-Server sauber schließen, um blockierte Ports zu vermeiden
onStop((callback) => {
  server.close(() => {
    console.log("[Grafana-Vigor] Webhook-Server gestoppt.");
    callback();
  });
}, 1000);
