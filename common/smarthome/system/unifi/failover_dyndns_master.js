/**
 * Name:    UniFi Master-Guard (Ereignis & Intervall)
 * Version: 5.0 (Silent Night)
 * Zweck:   Überwacht IP-Wechsel, Failover-Zeiten, DDNS-Updates
 * und prüft regelmäßig auf IP-Diskrepanzen.
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
  // Datenpunkte (Pfade bitte ggf. anpassen)
  dpWanIp: "unifi-network.0.devices.78:45:58:c7:61:75.ip",
  dpAktuelleIp: "0_userdata.0.System.aktuelle_IP",
  dpDdnssKey: "0_userdata.0.Unifi.ddnss_key",

  // IP-Adressen für die Logik
  ipFailover: "192.168.0.27", // Backup-Gateway (LTE)
  ipInternal: "192.168.1.1", // Lokale Gateway-IP (wird ignoriert)

  // Einstellungen
  checkInterval: "*/30 * * * *", // Alle 30 Minuten externer IP-Check
  startStundeRuhe: 20, // Ab 20:00 Uhr keine Sounds
  endeStundeRuhe: 8, // Ab 08:00 Uhr wieder mit Sound
};

// Interner Speicher für Zustände
let GUARD = {
  failoverActive: false,
  startTime: 0,
  discrepancyAlarm: false,
};

// --- 3. LOGIK BLOCK A: EREIGNISSE (IP-WECHSEL & FAILOVER) ---

/**
 * Reagiert sofort, wenn der UniFi-Adapter eine neue IP am WAN meldet.
 */
on({ id: CONFIG.dpWanIp, change: "ne" }, async (obj) => {
  const neueIp = obj.state.val;
  const gespeicherteIp = getState(CONFIG.dpAktuelleIp).val;

  // Sicherheits-Filter: Ignoriere ungültige oder rein interne Gateway-IPs
  if (!neueIp || neueIp === "0.0.0.0" || neueIp === CONFIG.ipInternal) return;

  // FALL 1: Start des Failovers (LTE übernimmt)
  if (neueIp === CONFIG.ipFailover) {
    GUARD.startTime = Date.now();
    GUARD.failoverActive = true;
    sendGlobalNotify( // Hier wird die globale Funktion verwendet
      "Internet-Failover",
      "Hauptleitung ausgefallen, Backup-LTE ist jetzt aktiv",
      8,
    );
    return;
  }

  // FALL 2: IP-Wechsel (DSL/Glasfaser) oder Rückkehr aus Failover
  if (neueIp !== gespeicherteIp && neueIp !== CONFIG.ipFailover) {
    // DDNS Update ausführen (native httpGet)
    const ddnssKey = getState(CONFIG.dpDdnssKey).val;
    if (ddnssKey) {
      httpGet(
        `https://www.ddnss.de/upd.php?key=${ddnssKey}&host=all`,
        (err) => {
          if (!err) console.log("UniFi-Guard: DDNS Update gesendet");
        },
      );
    }

    let title = "IP-Wechsel";
    let msg = `Neue WAN-IP: ${neueIp}, DDNS wurde aktualisiert`;

    // Dauer berechnen, falls wir aus einem Failover kommen
    if (GUARD.failoverActive) {
      const dauerMs = Date.now() - GUARD.startTime;
      const dauerText =
        dauerMs < 60000
          ? `${Math.round(dauerMs / 1000)} Sekunden`
          : `${(dauerMs / 60000).toFixed(1)} Minuten`;

      title = "Internet stabil";
      msg = `Die Hauptleitung ist nach ${dauerText} wieder da, neue IP: ${neueIp}`;
      GUARD.failoverActive = false;
    }

    sendGlobalNotify(msg, title, 5); // Hier wird die globale Funktion verwendet
    setState(CONFIG.dpAktuelleIp, neueIp, true);
  }
});

// --- 4. LOGIK BLOCK B: GUARD (INTERVALL-CHECK) ---

/**
 * Alle 30 Minuten: Vergleich der UniFi-IP mit der echten Welt (Amazon Check).
 */
schedule(CONFIG.checkInterval, async () => {
  httpGet("http://checkip.amazonaws.com", { timeout: 10000 }, (error, response) => {
    if (error || !response || response.statusCode !== 200) return;

    const echteIp = response.data.trim();
    const unifiIp = getState(CONFIG.dpWanIp).val;

    // Alarm auslösen bei Diskrepanz (außer während absichtlichem Failover)
    if (echteIp !== unifiIp && unifiIp !== CONFIG.ipFailover) {
      if (!GUARD.discrepancyAlarm) {
        const warnung =
          `IP-Abgleich fehlerhaft! ` +
          `UniFi meldet: ${unifiIp}, ` +
          `Amazon sieht: ${echteIp}, ` +
          `Prüfe die DynDNS-Funktion`;
        sendGlobalNotify(warnung, "UniFi Guard", 3); // Hier wird die globale Funktion verwendet
        GUARD.discrepancyAlarm = true;
      }
    }
    // Entwarnung, wenn alles wieder passt
    else if (GUARD.discrepancyAlarm) {
      sendGlobalNotify("IP-Abgleich wieder korrekt", "UniFi Guard", 1); // Hier wird die globale Funktion verwendet
      GUARD.discrepancyAlarm = false;
    }
  });
});
