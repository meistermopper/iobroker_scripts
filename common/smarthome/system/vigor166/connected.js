/* eslint-env es2022 */
/**
 * Name:    DrayTek Vigor 166 Online Status (Native Webhook)
 * Purpose: Creates states and starts a dedicated HTTP server
 *          for Grafana alerts with configurable notification channels.
 */

const http = require("node:http");

// --- CONFIGURATION ---
const HTTP_PORT = 8088; // Port on which the script listens for Grafana
const DP_CONNECTED = "0_userdata.0.Vigor166.connected"; // Target state for connection status
const DP_PAYLOAD = "0_userdata.0.Vigor166.grafana_payload"; // State for saving raw payload

// Notifications (channels individually toggleable)
const NOTIFY_TITLE = "DrayTek Vigor 166"; // Default title for messenger notifications
const NOTIFY_VOICE = true; // Send voice notification via Google Speaker (SayIt)
const VOICE_VOLUME = 50; // Voice notification volume (null/0 = disabled)

// --- LOGIC ---

// --- AUTOMATICALLY CREATE STATES ---

// Creation of the online status state (Type: Boolean)
createState(DP_CONNECTED, true, {
  name: "DrayTek Vigor 166 Online Status",
  desc: "Connection status managed by Grafana alerts (true = Connected, false = Disconnected)",
  type: "boolean",
  role: "indicator.connected",
  read: true,
  write: true,
  def: true,
});

// Creation of the state for storing the latest raw Grafana webhook payload
createState(DP_PAYLOAD, "", {
  name: "Grafana Alert Raw Payload",
  desc: "Receives raw unparsed webhook payload from Grafana",
  type: "string",
  role: "json",
  read: true,
  write: true,
  def: "",
});

// --- NOTIFICATION HELPER ---

/**
 * Sends notifications via sendGlobalNotify.
 * @param {string} text - Message text to be sent/announced
 * @param {number} priority - Message urgency (especially relevant for Gotify)
 */
function sendNotification(text, priority) {
  sendGlobalNotify(text, NOTIFY_TITLE, priority, NOTIFY_VOICE ? VOICE_VOLUME : null);
}

// --- DEDICATED HTTP WEBHOOK SERVER ---

// Instantiate local web server responding to Grafana webhooks
const server = http.createServer((req, res) => {
  // Only process POST requests since Grafana sends alerts via POST
  if (req.method === "POST") {
    let body = "";

    // Collect incoming data stream chunks
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    // Process payload after stream end
    req.on("end", () => {
      // Write raw payload to diagnostic state
      setState(DP_PAYLOAD, body, true);

      try {
        const payload = JSON.parse(body);

        // Check if payload contains a valid status
        if (payload?.status) {
          // 1. Intercept test alerts (Grafana "Test" button on contact point)
          const isTestAlert = payload.alerts?.some(
            (alert) => alert.labels?.alertname === "TestAlert",
          );
          if (isTestAlert) {
            console.log("[Grafana-Vigor] Test alert received. No state change applied.");
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Test-Alert OK");
            return;
          }

          // 2. Identify alert types
          // Check if any alert in the payload refers to a connection drop (Disconnect or Vigor 166 in name)
          const isDslDisconnect = payload.alerts?.some(
            (alert) =>
              alert.labels?.alertname?.toLowerCase()?.includes("disconnect") ||
              alert.labels?.alertname?.toLowerCase()?.includes("vigor 166"),
          );

          // Check if any alert reports a Signal-to-Noise Ratio (SNR) issue
          const isSnrWarning = payload.alerts?.some((alert) =>
            alert.labels?.alertname?.toLowerCase()?.includes("snr"),
          );

          // 3. Status evaluation & targeted notifications

          // Case A: Alert triggered (status === "firing")
          if (payload.status === "firing") {
            if (isDslDisconnect) {
              setState(DP_CONNECTED, false, true); // Set status to "Offline/Disconnected"
              console.warn(
                `[Grafana-Vigor] Alert FIRING (Disconnect) -> State '${DP_CONNECTED}' set to FALSE.`,
              );
              sendNotification(
                "Achtung: Die DSL-Verbindung über den DrayTek Vigor 166 wurde getrennt!",
                5, // Gotify priority: Warning / Critical
              );
            } else if (isSnrWarning) {
              console.warn("[Grafana-Vigor] Alert FIRING (Low SNR Warning).");
              sendNotification(
                "Warnung: Die Signal-Rausch-Toleranz der DSL-Leitung ist kritisch niedrig!",
                4, // Gotify priority: Warning
              );
            } else {
              console.log("[Grafana-Vigor] Ignored: Unknown FIRING alert.");
            }

            // Case B: Alert resolved (status === "resolved")
          } else if (payload.status === "resolved") {
            if (isDslDisconnect) {
              setState(DP_CONNECTED, true, true); // Set status to "Online/Connected"
              console.log(
                `[Grafana-Vigor] Alert RESOLVED (Disconnect) -> State '${DP_CONNECTED}' set to TRUE.`,
              );
              sendNotification(
                "Entwarnung: Der DrayTek Vigor 166 ist wieder online!",
                1, // Gotify priority: Info
              );
            } else if (isSnrWarning) {
              console.log("[Grafana-Vigor] Alert RESOLVED (Low SNR Warning).");
              sendNotification(
                "Entwarnung: Die Signal-Rausch-Toleranz der DSL-Leitung ist wieder stabil.",
                1, // Gotify priority: Info
              );
            } else {
              console.log("[Grafana-Vigor] Ignored: Unknown RESOLVED alert.");
            }
          }
        }

        // Return success response to Grafana
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      } catch (error) {
        console.error(`[Grafana-Vigor] Error processing webhook: ${error}`);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
      }
    });
  } else {
    // Reject non-POST methods
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
  }
});

// Start server on configured port
server.listen(HTTP_PORT, () => {
  console.log(`[Grafana-Vigor] Webhook server listening on port ${HTTP_PORT}`);
});

// Gracefully close HTTP server on script stop to prevent locked ports
onStop((callback) => {
  server.close(() => {
    console.log("[Grafana-Vigor] Webhook server stopped.");
    callback();
  });
}, 1000);
