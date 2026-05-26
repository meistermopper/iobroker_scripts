/**
 * =============================================================================
 * SKRIPT: CHROMECAST-CLEANER & HEOS-SCHUTZSCHILD (V7.1)
 * -----------------------------------------------------------------------------
 * DIE PHILOSOPHIE DIESES SKRIPTS:
 * Der Chromecast-Adapter (v4+) hat oft Probleme mit HEOS-Geräten (Denon/Marantz).
 * Er findet sie im Netzwerk via mDNS, kann sie aber nicht stabil einbinden.
 * Seit dem UDM-Pro Update (v5.1.12) werden mDNS-Pakete so effizient verteilt,
 * dass der Adapter die Geräte im Sekundentakt neu erkennt.
 *
 * PROBLEM:
 * 1. Löschen (deleteObject) im laufenden Betrieb führt zum "TypeError: socket of null",
 *    da der Adapter intern Referenzen auf das gelöschte Objekt hält.
 * 2. Dieser Absturz blockiert die Event-Loop und trennt auch echte Google Minis.
 *
 * LÖSUNG (Die "Neutralisierung"):
 * Wir lassen das Objekt im ioBroker-Baum existieren, biegen aber die IP-Adresse
 * auf "0.0.0.0" und den Port auf "0" um. Zusätzlich wird der 'enabled'-Datenpunkt
 * deaktiviert und schreibgeschützt (write: false).
 * Der Adapter findet das Objekt weiterhin (kein Absturz), der Verbindungsversuch
 * schlägt aber auf Netzwerkebene sofort fehl.
 *
 * SICHERHEITSNETZ (Tiefenreinigung):
 * Wenn der Adapter trotzdem Amok läuft (Watchdog), wird er gestoppt,
 * im Offline-Zustand neutralisiert und frisch gestartet.
 * -----------------------------------------------------------------------------
 */

// 1. FILTER-DEFINITIONEN

// Namen von Geräten, die wir im Chromecast-Adapter nicht sehen wollen.
// (Wird zur Prüfung normalisiert: Unterstriche werden zu Leerzeichen)
const bannedDeviceNames = [
    'HEOS Sauna',
    'HEOS_Sauna',
    'Marantz CINEMA 60',
    'Marantz_CINEMA_60',
    'Heos5'
];

// Bekannte Hardware-IDs (MAC-Adressen ohne Doppelpunkt), die blockiert werden sollen.
// Dies ist unsere "zweite Verteidigungslinie", falls der Name noch nicht geladen wurde.
const bannedDeviceIds = [
    '0005cd77e0a8', // HEOS Sauna
    '000678ef039d', // Marantz CINEMA 60
    'b87bd4deaa73'  // Dubletten-ID aus Logs
];

// Da deine HEOS-Geräte feste IPs haben, ist dies der sicherste Filter.
// Jedes Gerät, das mit einer dieser IPs auftaucht, wird sofort neutralisiert.
const bannedIPs = [
    '192.168.178.222', // Beispiel: HEOS Sauna
    '192.168.178.32',  // Beispiel: Marantz
    '192.168.178.34'   // Heos5
];

// Ziel-Instanz, die überwacht wird
const adapterInstance = 'chromecast.0';

// 2. STATUS-VARIABLEN

// Speichert Geräte, die gerade bearbeitet werden, um Mehrfach-Trigger zu vermeiden.
const pendingDeletions = new Set();

// Fehler-Zähler und Zeitstempel für den automatischen Neustart (Watchdog).
let adapterErrorCount = 0; // Aktuelle Fehlerlast
let lastRestart = 0;       // Zeitpunkt des letzten automatischen Neustarts
let isRepairing = false;   // Flag, während die "Tiefenreinigung" läuft

/**
 * NEUTRALISIEREN statt Löschen:
 * Setzt die IP eines Geräts auf 0.0.0.0 und markiert den Namen als BANNED.
 * Dies verhindert die gefürchteten "TypeError: socket of null" Abstürze.
 */
async function neutralizeDevice(devicePath, reason) {
    if (pendingDeletions.has(devicePath)) return; // Dubletten-Schutz
    pendingDeletions.add(devicePath);

    const addrId = `${devicePath}.address`;
    const nameId = `${devicePath}.name`;
    const portId = `${devicePath}.port`; // Port-Datenpunkt
    const enabledId = `${devicePath}.enabled`; // Der entscheidende Schalter

    try {
        // SCHRITT 1: Den Adapter-internen 'enabled' Schalter hart auf false setzen und sperren
        if (existsObject(enabledId)) {
            log(`Schutzmaßnahme: ${enabledId} wird deaktiviert und für den Adapter schreibgeschützt (write: false).`, 'warn');
            await setStateAsync(enabledId, false, true);
            // Wir entziehen dem Adapter das Schreibrecht für diesen Datenpunkt
            await extendObjectAsync(enabledId, { common: { write: false } });
        }

        // Nur neutralisieren, wenn die IP nicht schon 0.0.0.0 ist
        if (existsState(addrId) && getState(addrId).val !== '0.0.0.0') {
            log(`Neutralisierung: ${devicePath} wird stillgelegt (IP/Port -> 0). Grund: ${reason}`, 'warn');

            // SCHRITT 2: IP und Port auf ungültig setzen
            await setStateAsync(addrId, '0.0.0.0', true);
            if (existsState(portId)) await setStateAsync(portId, 0, true);

            // SCHRITT 3: Name zur visuellen Kontrolle markieren
            if (existsState(nameId)) {
                await setStateAsync(nameId, 'BANNED - ' + (getState(nameId).val || 'Unknown'), true);
            }

            // Nach 10 Sekunden wieder für Trigger freigeben
            setTimeout(() => pendingDeletions.delete(devicePath), 10000);
        }
    } catch (e) {
        log(`Fehler bei Neutralisierung von ${devicePath}: ${e}`, 'error');
        pendingDeletions.delete(devicePath);
    }
}

/**
 * Kern-Logik: Prüft, ob ein Gerät (anhand ID, IP oder Name) auf der Verbotsliste steht.
 * @param {string} val - Der Wert (Name oder IP) des States
 * @param {string} fullId - Die vollständige ID des States
 */
function checkAndFilter(val, fullId) {
    // Während der Adapter gerade repariert wird, ignorieren wir Events
    if (isRepairing) return;

    // Identifizieren, ob wir gerade eine IP-Adresse (.address) oder einen Namen (.name) prüfen
    const isAddress = fullId.endsWith('.address');

    // Extrahiere den Gerätepfad (z.B. chromecast.0.0005cd77e0a8)
    const parts = fullId.split('.');
    if (parts.length < 3) return;

    const deviceId = parts[2];
    const devicePath = parts[0] + '.' + parts[1] + '.' + parts[2];
    let shouldNeutralize = false;
    let reason = '';

    // Prüfung 1: Ist die ID in der Verbotsliste?
    if (bannedDeviceIds.includes(deviceId)) {
        shouldNeutralize = true;
        reason = `Geräte-ID '${deviceId}' steht auf der schwarzen Liste`;
    }

    // Prüfung 2: Ist es eine gesperrte IP?
    if (!shouldNeutralize && isAddress && bannedIPs.includes(String(val))) {
        shouldNeutralize = true;
        reason = `IP-Adresse '${val}' steht auf der schwarzen Liste`;
    }

    // Prüfungen, die einen gültigen Namen erfordern (nur wenn es keine IP-Adresse ist)
    if (!shouldNeutralize && val && typeof val === 'string' && !isAddress) {
        // Prüfung 2: Ist es in der HEOS-Verbotsliste (Name)?
        // Wir normalisieren Unterstriche zu Leerzeichen, da der Adapter hier variiert
        const normalizedName = val.trim().replace(/_/g, ' ');
        if (bannedDeviceNames.includes(normalizedName)) {
            shouldNeutralize = true;
            reason = `Gerät '${val}' steht auf der Verbotsliste (HEOS-Filter)`;
        }

        // Prüfung 3: Ist der Eintrag als unvollständig markiert?
        if (!shouldNeutralize && val.includes('(unvollständig)')) {
            shouldNeutralize = true;
            reason = 'Unvollständiger Eintrag erkannt (Chromecast-Fehler)';
        }
    }

    if (shouldNeutralize) {
        // Wenn ein Grund gefunden wurde: Stilllegen.
        neutralizeDevice(devicePath, reason);
    }
}

/**
 * TIEFENREINIGUNG: Stoppt den Adapter, löscht alle Leichen im ioBroker-Baum und startet neu.
 * Dies ist die einzige Methode, um den internen Cache des Adapters sicher zu leeren.
 */
async function performDeepClean() {
    if (isRepairing) return;
    isRepairing = true;

    log(`[Watchdog] Kritischer Zustand! Starte Tiefenreinigung für ${adapterInstance} (Offline-Bereinigung)...`, 'warn');

    try {
        // 1. Adapter hart stoppen
        await stopInstanceAsync(adapterInstance);
        await wait(3000); // Warten bis Sockets geschlossen sind und Adapter komplett beendet ist

        // 2. Suche alle verbliebenen Problemfälle im ioBroker-Baum während der Adapter OFF ist
        const pathsToFix = new Set();

        // Suche über IDs
        for (const id of bannedDeviceIds) {
            const path = `${adapterInstance}.${id}`;
            if (existsObject(path)) pathsToFix.add(path);
        }

        // Suche über IPs in den verbliebenen Objekten
        $(adapterInstance + '.*.address').each(id => {
            if (bannedIPs.includes(getState(id).val)) {
                pathsToFix.add(id.split('.').slice(0, 3).join('.'));
            }
        });

        // Suche über Namen (Normalisiert)
        $(adapterInstance + '.*.name').each(id => {
            const name = getState(id).val;
            if (name && bannedDeviceNames.includes(String(name).trim().replace(/_/g, ' '))) {
                pathsToFix.add(id.split('.').slice(0, 3).join('.'));
            }
        });

        // Problemfälle offline neutralisieren (IP 0.0.0.0 und Enabled False)
        for (const path of pathsToFix) {
            log(`[Watchdog] Offline-Bereinigung: Neutralisiere Pfad ${path}`, 'info');

            // Offline-Neutralisierung (sicherer als Löschen)
            const enabledId = `${path}.enabled`;
            if (existsObject(enabledId)) {
                await setStateAsync(enabledId, false, true);
                await extendObjectAsync(enabledId, { common: { write: false } });
            }
            await setStateAsync(`${path}.address`, '0.0.0.0', true);
            if (existsState(`${path}.port`)) await setStateAsync(`${path}.port`, 0, true);
        }

        // 3. Adapter wieder hochfahren
        await wait(1000);
        await startInstanceAsync(adapterInstance);
        log(`[Watchdog] Tiefenreinigung abgeschlossen. ${adapterInstance} wurde neu gestartet.`, 'info');
    } catch (e) {
        log(`[Watchdog] Fehler bei Tiefenreinigung: ${e}`, 'error');
    } finally {
        isRepairing = false;
        adapterErrorCount = 0;
        lastRestart = Date.now();
    }
}

/**
 * WATCHDOG: Überwacht das ioBroker Log auf Fehlermeldungen des Adapters.
 * Wenn zu viele Fehler auftreten, wird eine Tiefenreinigung ausgelöst.
 */
onLog('error', (data) => {
    if (data.from.startsWith(adapterInstance)) {
        const msg = data.message;

        // KRITISCHE FEHLER-ERKENNUNG:
        // 1. TypeError/socket/unique: Der Adapter-Kern ist abgestürzt (HEOS-Problem).
        // 2. "Cannot get status" bei echten Google-Geräten nach der Startphase (3 Min).
        const isSocketCrash = msg.includes('TypeError') || msg.includes('socket') || msg.includes('unique');
        const isBlockade = msg.includes('Cannot get status') && !msg.includes('HEOS') && (Date.now() - lastRestart > 180000); // 3 Min Karenz
        const isCritical = isSocketCrash || isBlockade;

        // Sofort-Reaktion bei "not unique" Fehlern
        if (msg.includes('is not unique')) {
            const idMatch = msg.match(/([a-f0-9]{12})/i);
            if (idMatch) {
                const extractedId = idMatch[1];
                neutralizeDevice(`${adapterInstance}.${extractedId}`, `Extrahiert aus 'not unique' Fehlermeldung`);
            }
        }

        // Gewichtung der Fehler: Kritische Fehler (Crash/Blockade) füllen den Zähler sofort.
        // Damit reichen 5 schwere Crash-Meldungen für eine Reparatur.
        adapterErrorCount += isCritical ? 10 : 1;

        // Schwellenwert erreicht (50): Reparatur einleiten.
        if (adapterErrorCount >= 50) {
            const now = Date.now();
            if (now - lastRestart > 300000) { // Max alle 5 Minuten neustarten
                performDeepClean();
            }
        }
    }
});

// Fehlerzähler alle 60 Sekunden reduzieren, damit normale Fehler nicht zum Neustart führen
// (Dies verhindert, dass der Adapter wegen gelegentlicher WLAN-Abbrüche neu startet)
setInterval(() => {
    adapterErrorCount = Math.max(0, adapterErrorCount - 1);
}, 60000);

/**
 * TRIGGER: Überwachung auf neue oder geänderte Gerätenamen oder Adressen
 * Verwendet einen regulären Ausdruck (RegExp), um alle passenden Datenpunkte im Adapter zu finden.
 */
on({id: new RegExp('^' + adapterInstance.replace('.', '\\.') + '\\..*\\.(name|address)$'), change: 'any'}, function (obj) {
    checkAndFilter(obj.state.val, obj.id);
});

/**
 * 4. INITIALISIERUNG
 * Wird beim Speichern des Skripts oder Start des JS-Adapters ausgeführt.
 * Scannt den kompletten Objektbaum nach bereits vorhandenen Leichen.
 */
log('Chromecast-Cleaner & HEOS-Schutzschild aktiv', 'info');

// Alle ".name" Zustände prüfen
$(adapterInstance + '.*.name').each(function(id) {
    const val = getState(id).val;
    checkAndFilter(val, id);
});

// Alle ".address" Zustände prüfen
$(adapterInstance + '.*.address').each(function(id) {
    const val = getState(id).val;
    checkAndFilter(val, id);
});
