/**
 * Name:    DrayTek Vigor 166 Online-Status (Nativer Webhook)
 * Zweck:   Erstellt die Datenpunkte und startet einen eigenen HTTP-Server
 *          für Grafana-Alerts mit konfigurierbaren Benachrichtigungskanälen.
 */

const http = require("node:http");

// --- KONFIGURATION ---
const HTTP_PORT = 8088; // Port, auf dem das Skript für Grafana lauscht
const DP_CONNECTED = "0_userdata.0.Vigor166.connected";
const DP_PAYLOAD = "0_userdata.0.Vigor166.grafana_payload";
const ALERT_NAME_FILTER = "Vigor 166"; // Leer lassen, um jeden Alert zu akzeptieren

// Benachrichtigungen (Kanäle einzeln aktivierbar/deaktivierbar)
const NOTIFY_TELEGRAM = false; // Telegram-Benachrichtigungen über dieses Skript senden
const NOTIFY_GOTIFY = false; // Gotify-Benachrichtigungen über dieses Skript senden
const NOTIFY_VOICE = true; // Sprachansage über Google Speaker (SayIt) senden
const NOTIFY_TITLE = "DrayTek Vigor 166";
const VOICE_VOLUME = 50; // Lautstärke der Sprachansage (null/0 = deaktiviert)

// --- DATENPUNKTE AUTOMATISCH ERSTELLEN ---

createState(DP_CONNECTED, true, {
  name: "DrayTek Vigor 166 Online-Status",
  desc: "Verbindungsstatus gesteuert durch Grafana Alerts (true = Connected, false = Disconnected)",
  type: "boolean",
  role: "indicator.connected",
  read: true,
  write: true,
  def: true,
});

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
 * Sendet Benachrichtigungen über die konfigurierten Kanäle.
 * @param {string} text - Nachrichtentext
 * @param {number} priority - Gotify Priorität (1 = Info, 5 = Warnung)
 */
function sendNotification(text, priority) {
  // 1. Telegram
  if (NOTIFY_TELEGRAM) {
    sendTo("telegram.0", "send", {
      text: `[${NOTIFY_TITLE}] ${text}`,
    });
  }

  // 2. Gotify
  if (NOTIFY_GOTIFY) {
    const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker")?.val;
    if (gotifyToken) {
      const url = `https://mygotify.meistermopper.de/message?token=${gotifyToken}`;
      const cleanText = text.replace(/<\/?[^>]+(>|$)/g, ""); // HTML-Tags entfernen
      const payload = { title: NOTIFY_TITLE, message: cleanText, priority: priority };

      httpPost(url, payload, { timeout: 5000 }, (error) => {
        if (error) console.error(`[Grafana-Vigor] Gotify Fehler: ${error}`);
      });
    }
  }

  // 3. Sprachausgabe (SayIt)
  if (NOTIFY_VOICE && VOICE_VOLUME !== null && VOICE_VOLUME > 0) {
    const voiceText = text
      .replace(/\p{Extended_Pictographic}/gu, "") // Emojis entfernen
      .replace(/\s\s+/g, " ")
      .trim();

    sendTo("sayit", "say", { text: voiceText, volume: VOICE_VOLUME });
  }
}

// --- EIGENER HTTP-WEBHOOK-SERVER ---

const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      // Raw Payload in den Datenpunkt schreiben (zur Einsicht)
      setState(DP_PAYLOAD, body, true);

      try {
        const payload = JSON.parse(body);

        if (payload?.status) {
          // 1. Test-Alerts abfangen (Grafana Kontaktpunkt-Test)
          const isTestAlert = payload.alerts?.some(
            (alert) => alert.labels?.alertname === "TestAlert",
          );
          if (isTestAlert) {
            console.log("[Grafana-Vigor] Test-Alert empfangen. Keine Statusänderung vorgenommen.");
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Test-Alert OK");
            return;
          }

          // 2. Alert-Name Filter
          if (ALERT_NAME_FILTER) {
            const hasMatchingAlert = payload.alerts?.some((alert) =>
              alert.labels?.alertname?.toLowerCase().includes(ALERT_NAME_FILTER.toLowerCase()),
            );
            if (!hasMatchingAlert) {
              console.log(
                `[Grafana-Vigor] Ignoriert: Kein Alert passte zum Filter "${ALERT_NAME_FILTER}".`,
              );
              res.writeHead(200, { "Content-Type": "text/plain" });
              res.end("Ignored by filter");
              return;
            }
          }

          console.log(`[Grafana-Vigor] Neuer Alert-Payload empfangen. Status: ${payload.status}`);

          // 3. Status setzen & Benachrichtigungen senden
          if (payload.status === "firing") {
            setState(DP_CONNECTED, false, true);
            console.warn(
              `[Grafana-Vigor] Alarm FIRING -> Status '${DP_CONNECTED}' auf FALSE gesetzt.`,
            );

            sendNotification(
              "Achtung: Die DSL-Verbindung über den DrayTek Vigor 166 wurde getrennt!",
              5, // Gotify-Prio: Warnung
            );
          } else if (payload.status === "resolved") {
            setState(DP_CONNECTED, true, true);
            console.log(
              `[Grafana-Vigor] Alarm RESOLVED -> Status '${DP_CONNECTED}' auf TRUE gesetzt.`,
            );

            sendNotification(
              "Entwarnung: Der DrayTek Vigor 166 ist wieder online!",
              1, // Gotify-Prio: Info
            );
          }
        }

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      } catch (error) {
        console.error(`[Grafana-Vigor] Fehler beim Verarbeiten des Webhooks: ${error}`);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
      }
    });
  } else {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
  }
});

// Server auf gewähltem Port starten
server.listen(HTTP_PORT, () => {
  console.log(`[Grafana-Vigor] Webhook-Server lauscht auf Port ${HTTP_PORT}`);
});

// Bei Skript-Stopp den Server sauber schließen
onStop((callback) => {
  server.close(() => {
    console.log("[Grafana-Vigor] Webhook-Server gestoppt.");
    callback();
  });
}, 1000);
