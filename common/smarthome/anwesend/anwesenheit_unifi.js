/* eslint-env es2022 */
/**
 * =============================================================================
 * UNIFI ANWESENHEITS-MONITORING
 * =============================================================================
 * ZWECK: Überwacht die Anwesenheit von Personen basierend auf dem Online-Status
 * ihrer Smartphones im UniFi-WLAN.
 *
 * FUNKTIONSWEISE:
 * 1. Beim Start werden für jede Person zwei Datenpunkte unter '0_userdata.0' erzeugt:
 *    - Status (Boolean): Ob die Person als online/anwesend gilt.
 *    - Text (String): Ein lesbarer Statustext.
 * 2. Das Skript abonniert den 'isOnline'-Datenpunkt des UniFi-Adapters für jedes Gerät.
 * 3. Geht ein Gerät offline, wird ein Puffer-Timer gestartet (Standard: 2 Minuten).
 *    Erst wenn das Gerät nach Ablauf dieses Timers immer noch offline ist, wird der Status
 *    auf "offline" geändert. Dies verhindert Fehlalarme bei kurzem Verbindungsverlust
 *    oder beim Wechsel des Access Points (Roaming).
 * 4. Geht das Gerät innerhalb des Puffers wieder online, wird der Timer abgebrochen.
 * 5. Statusänderungen werden per Telegram und Gotify gemeldet.
 * =============================================================================
 */

// --- KONFIGURATION ---
// Liste der zu überwachenden Personen mit Name, MAC-Adresse und Ausschaltverzögerung (in ms)
const people = [
  { name: "Thomas", mac: "dc:e5:5b:11:b8:7e", delay: 120000 }, // 2 Minuten Puffer
  { name: "Kiki", mac: "78:53:64:01:8b:04", delay: 120000 },
  { name: "Thomas_6G", mac: "1e:4a:b7:65:28:3c", delay: 120000 },
];

// Basispfad für die selbst erstellten ioBroker-Datenpunkte
const basePath = "0_userdata.0.Unifi.Anwesenheit";
// Pfad zum Gotify-Token für Benachrichtigungen
const gotifyTokenDP = "0_userdata.0.gotifytoken.iobroker";
// Telegram-Empfänger (Name des Benutzers im Telegram-Adapter)
const telegramUser = "Thomas";

// --- INITIALISIERUNG ---
/**
 * Initialisiert das Skript: Erstellt die benötigten Datenpunkte
 * und startet die Logik für alle konfigurierten Personen.
 */
async function init() {
  for (const person of people) {
    // Datenpunkt für den Online-Zustand (True/False) erstellen
    await createStateAsync(`${basePath}.${person.name}_IsOnline`, {
      name: `${person.name} Status`,
      type: "boolean",
      role: "indicator.connected",
      def: false,
    });

    // Datenpunkt für die lesbare Statusmeldung erstellen
    await createStateAsync(`${basePath}.${person.name}`, {
      name: `${person.name} Text`,
      type: "string",
      role: "text",
      def: "noch leer",
    });

    // Überwachungslogik für diese Person einrichten
    setupPresenceLogic(person);
  }
}

// --- LOGIK ---
/**
 * Richtet die Statusüberwachung und Entprell-Logik für eine Person ein.
 * @param {{ name: string, mac: string, delay: number }} person - Das Person-Konfigurationsobjekt
 */
function setupPresenceLogic(person) {
  // Der Datenpunkt aus dem UniFi-Adapter, der den aktuellen WLAN-Status liefert
  const triggerId = `unifi-network.0.clients.users.${person.mac}.isOnline`;
  // Timer-Referenz für die Offline-Verzögerung
  /** @type {any} */
  let offlineTimer = null;

  // 1. Initialer Statusabgleich beim Skriptstart (ohne Benachrichtigung)
  const triggerState = getState(triggerId);
  const initialOnline = triggerState ? !!triggerState.val : false;
  updateStatus(person, initialOnline, true);

  // 2. Event-Listener auf Zustandsänderungen des UniFi-Geräts
  on({ id: triggerId, change: "ne" }, (obj) => {
    const currentlyOnline = !!obj.state.val;
    const lastStatusState = getState(`${basePath}.${person.name}_IsOnline`);
    const lastStatus = lastStatusState ? lastStatusState.val : null;

    if (currentlyOnline) {
      // Gerät ist wieder im WLAN
      if (offlineTimer) {
        // Laufenden Offline-Timer stoppen, da das Gerät rechtzeitig zurück ist
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }

      // Nur benachrichtigen, wenn die Person vorher als "Offline" markiert war
      if (lastStatus === false) {
        updateStatus(person, true);
      }
    } else {
      // Gerät hat das WLAN verlassen -> Erst nach Ablauf des Timers wirklich offline setzen
      if (!offlineTimer) {
        offlineTimer = setTimeout(() => {
          updateStatus(person, false);
          offlineTimer = null;
        }, person.delay || 120000);
      }
    }
  });
}

// --- STATUS UPDATE & NOTIFY ---
/**
 * Aktualisiert die Datenpunkte und sendet Benachrichtigungen.
 * @param {{ name: string, mac: string, delay: number }} person - Die betroffene Person
 * @param {boolean} isOnline - Der neue Status
 * @param {boolean} [silent=false] - Wenn true, werden keine Benachrichtigungen gesendet (z.B. beim Start)
 */
function updateStatus(person, isOnline, silent = false) {
  const statusId = `${basePath}.${person.name}_IsOnline`;
  const textId = `${basePath}.${person.name}`;
  const text = `Das Smartphone von ${person.name} ist ${isOnline ? "online ✅" : "offline ❌"}`;

  // Datenpunkte in ioBroker aktualisieren (bestätigt: ack=true)
  setState(statusId, isOnline, true);
  setState(textId, text, true);

  // Benachrichtigungen überspringen, falls silent=true
  if (silent) return;

  // 1. Benachrichtigung per Telegram senden
  sendTo("telegram.0", { user: telegramUser, text: text });

  // 2. Benachrichtigung per Gotify senden (ressourcenschonend via nativem httpPost statt curl)
  const tokenState = getState(gotifyTokenDP);
  const token = tokenState ? tokenState.val : null;
  if (token) {
    const url = `https://mygotify.meistermopper.de/message?token=${token}`;
    const payload = {
      title: "ioBroker",
      message: text,
      priority: 1,
    };

    httpPost(url, payload, { timeout: 5000 }, (error) => {
      if (error) console.error(`[Anwesenheit] Gotify Fehler: ${error}`);
    });
  }
}

// Skript starten
init();
