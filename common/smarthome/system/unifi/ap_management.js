/* eslint-env es2022 */
/**
 * Name:   AP-Manager
 * Zweck:  Überwacht UniFi-Accesspoints auf Fehlerzustände und benachrichtigt bei Problemen.
 */

// --- KONFIGURATION ---
const AP_DEVICES = [
  { id: "e0:63:da:73:b5:4a", name: "Obergeschoss" },
  { id: "e0:63:da:73:b5:4c", name: "Keller" },
];

const BASE_PATH = "unifi-network.0.devices";

// --- LOGIK ---
const errorIds = AP_DEVICES.map((ap) => `${BASE_PATH}.${ap.id}.hasError`);

on({ id: errorIds, change: "ne" }, (obj) => {
  // Wenn hasError ungleich 0 (oder true/nicht-leer) ist
  if (obj.state.val !== 0 && obj.state.val !== false && obj.state.val !== null) {
    const ap = AP_DEVICES.find((a) => obj.id.includes(a.id)); // Finde den AP, der den Fehler meldet
    if (ap) {
      sendGlobalNotify(
        `⚠️ Der Accesspoint ${ap.name} (${ap.id}) benötigt Aufmerksamkeit!`,
        "AP-Manager",
        5,
      );
    }
  }
});
