/**
 * ioBroker Script: Harvia Fenix FX 110C (inkl. Remote-Steuerung)
 * -----------------------------------------------------------------------------
 * LOGIK-ÜBERSICHT: Das Skript überwacht nicht nur die Live-Daten der Sauna,
 * sondern ermöglicht auch die vollständige Steuerung (Heizung, Licht, Temperatur)
 * über die offiziellen REST-API-Endpunkte des Harvia Device Service.
 */

// --- KONFIGURATION & GLOBALE VARIABLEN ---
const BASE_PATH       = '0_userdata.0.Energie.Sauna'; // Speicherort der Datenpunkte
const axios           = require('axios');             // Bibliothek für HTTP-Anfragen
const REFRESH_MS      = 60 * 1000;                    // Status-Intervall (Cloud-Daten sind meist 60s verzögert)
const LOGIN_REFRESH   = 50 * 60 * 1000;               // JWT-Token hält 60 Min, wir erneuern nach 50 Min.

// Identifikations-Daten (fest verknüpft mit dem MyHarvia-Account)
const CLIENT_ID       = '24emhb2mm0v4sscqhbdev86b2v';
const FIXED_ID        = '73293847-550d-40da-8bcf-3d6e2fcf5add'; // Die interne ID deiner Fenix-Steuerung
const PARTNER_ID      = 'ORG/prod:0:6656:0';                    // Identifiziert den App-Partner (Harvia)

const client = axios.create({ timeout: 20000 });     // Axios-Instanz mit 20s Timeout

// Zwischenspeicher für die Sitzung und dynamische URLs:
let idToken        = ''; // Das JWT-Ticket für die API-Authentifizierung
let dataBaseUrl    = ''; // Server-Adresse für Live-Daten (Data Service)
let deviceBaseUrl  = ''; // Server-Adresse für Steuerbefehle (Device Service) -> NEU!
let controlBaseUrl = ''; // Basis-Adresse für Generics (Auth)
let authUrl        = ''; // Endpunkt für die Anmeldung

// Logik-Flags
let isLoggingIn     = false; // Verhindert doppelte Login-Aufrufe (Race Condition Guard)
let isSendingCommand = false; // Verhindert parallele Befehle an die Cloud
let lastEventTime   = {};     // Speichert Zeitstempel pro Datenpunkt zur Entprellung
let lastCommandTime = 0;     // Timestamp der letzten Aktion, um Polling-Überschreiben zu verhindern
const LATENCY_MS    = 5000;  // Zeit (5s), die wir nach einem Befehl warten, bevor wir Telemetrie wieder trauen

// Hilfsfunktion für Pausen
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 1. INITIALISIERUNG (ensureStatesExist)
 * Stellt sicher, dass alle Datenpunkte in ioBroker existieren.
 */
async function ensureStatesExist() {
    const states = [
        { id: 'user',                 type: 'string',  role: 'text',                  def: '' },
        { id: 'password',           type: 'string',  role: 'text',                  def: '' },
        { id: 'online',             type: 'boolean', role: 'indicator.reachable',   def: false },
        { id: 'heatOn',             type: 'boolean', role: 'switch.power',          def: false },
        { id: 'lightOn',            type: 'boolean', role: 'switch.light',          def: false },
        { id: 'temp',               type: 'number',  role: 'value.temperature',     unit: '°C', def: 0 },
        { id: 'panelTemp',          type: 'number',  role: 'value.temperature',     unit: '°C', def: 0 },
        { id: 'heaterPower',        type: 'number',  role: 'value.power',           unit: 'W',  def: 0 },
        { id: 'totalBathingHours',  type: 'number',  role: 'value.number',          unit: 'h',  def: 0 },
        { id: 'totalOperatingHours',type: 'number',  role: 'value.number',          unit: 'h',  def: 0 },
        { id: 'totalSessions',      type: 'number',  role: 'value.number',          def: 0 },
        { id: 'targetTemp',         type: 'number',  role: 'level.temperature',     unit: '°C', def: 90 },
        { id: 'doorSafety',         type: 'boolean', role: 'indicator.safety',      def: false },
        { id: 'remoteControl',      type: 'boolean', role: 'indicator.state',       def: false },
        { id: 'errorMsg',           type: 'string',  role: 'text',                  def: '' },
        { id: 'readyNotified',      type: 'boolean', role: 'indicator',             def: false }
    ];
    for (const s of states) {
        await createStateAsync(`${BASE_PATH}.${s.id}`, s.def, {
            name: s.id, type: s.type, role: s.role, unit: s.unit, read: true, write: true
        });
    }
}

/**
 * 2. ENDPUNKTE LADEN (fetchConfig)
 * Holt die aktuellen regionalen API-Server-Adressen von Harvia ab.
 */
async function fetchConfig() {
    try {
        const response = await client.get("https://api.harvia.io/endpoints");
        const ep = response.data.endpoints.RestApi;

        dataBaseUrl = ep.data.https;
        deviceBaseUrl = ep.device.https;
        controlBaseUrl = ep.generics.https;
        authUrl = `${ep.generics.https}/auth/token`;
        return true;
    } catch (err) {
        log(`[Harvia] Fehler beim Laden der API-Konfiguration: ${err.message} - Nutze Fallback-URLs`, 'warn');
        return false;
    }
}

/**
 * 3. ANMELDUNG (login)
 * Authentifiziert das Skript an der Cloud und holt das ID-Token.
 */
async function login() {
    // RACE-CONDITION-SCHUTZ:
    // Falls gerade ein Login-Prozess läuft, warten wir bis zu 5 Sekunden, ob er fertig wird.
    if (isLoggingIn) {
        let checks = 0;
        while (isLoggingIn && checks < 10) {
            await wait(500);
            checks++;
        }
        if (idToken) return true;
    }

    isLoggingIn = true;

    const user = getState(`${BASE_PATH}.user`).val;
    const pass = getState(`${BASE_PATH}.password`).val;

    if (!user || !pass) {
        log('[Harvia] Login-Fehler: Benutzerdaten in 0_userdata fehlen!', 'warn');
        isLoggingIn = false;
        return false;
    }

    try {
        if (!(await fetchConfig())) {
            log('[Harvia] Login abgebrochen: Konfiguration konnte nicht geladen werden', 'warn');
            return false;
        }

        const response = await client.post(authUrl, {
            username: user, password: pass, client_id: CLIENT_ID
        });
        idToken = response.data.idToken;
        return true;
    } catch (err) {
        log(`[Harvia] Login fehlgeschlagen: ${err.message}`, 'error');
        return false;
    } finally {
        isLoggingIn = false; // Sperre in jedem Fall wieder aufheben
    }
}

/**
 * 4. REMOTE-STEUERUNG (setSaunaState)
 * Sendet Steuerbefehle an den korrekten Device Service der Harvia Cloud.
 * @param {boolean} isRetry - Flag, ob es sich um einen internen Wiederholungsversuch handelt
 */
async function setSaunaState(stateName, value, isRetry = false) {
    if (!idToken || !deviceBaseUrl) {
        log(`[Harvia] Abbruch: Noch nicht eingeloggt oder Endpunkte unbekannt.`, 'warn');
        return;
    }

    // Lock-Check: Nur blockieren, wenn es kein interner Retry ist
    if (isSendingCommand && !isRetry) {
        log(`[Harvia] Befehl '${stateName}' blockiert: Eine Cloud-Anfrage ist bereits aktiv.`, 'debug');
        return;
    }

    isSendingCommand = true;

    try {
        // TYP A: Schaltsignale (Licht/Heizung) via POST
        if (stateName === 'heatOn' || stateName === 'lightOn') {
            const commandType = stateName === 'heatOn' ? 'SAUNA' : 'LIGHTS';
            const boolValue = !!value; // Sicherstellung der Boolean-Konvertierung
            const stateStr = boolValue ? 'on' : 'off';

            const payload = {
                deviceId: FIXED_ID,
                cabin: { id: 'C1' }, // C1 ist die Standard-Zuweisung bei Fenix
                command: {
                    type: commandType,
                    state: stateStr
                }
            };

            const response = await client.post(`${deviceBaseUrl}/devices/command`, payload, {
                headers: {
                    'Authorization': `Bearer ${idToken.trim()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.handled) {
                log(`[Harvia] ${commandType === 'SAUNA' ? 'Heizung' : 'Licht'} -> ${stateStr}`, 'info');

                // BESTÄTIGUNG: Wir setzen ack: true sofort, damit die UI nicht "springt"
                setState(`${BASE_PATH}.${stateName}`, boolValue, true);

                if (stateName === 'heatOn') setState(`${BASE_PATH}.errorMsg`, '', true);
                lastCommandTime = Date.now(); // Timestamp für Latenz-Schutz setzen
            } else {
                const reason = response.data ? response.data.failureReason : 'Unbekannt';
                log(`[Harvia] Cloud lehnt Befehl ab: ${reason}`, 'warn');
                setState(`${BASE_PATH}.errorMsg`, `Cloud-Fehler: ${reason}`, true);
            }

        // TYP B: Temperatur-Änderung via PATCH
        } else if (stateName === 'targetTemp') {
            const payload = {
                deviceId: FIXED_ID,
                cabin: { id: 'C1' },
                temperature: parseFloat(value) // Muss zwingend eine Zahl sein
            };

            await client.patch(`${deviceBaseUrl}/devices/target`, payload, {
                headers: {
                    'Authorization': `Bearer ${idToken.trim()}`,
                    'Content-Type': 'application/json'
                }
            });
            log(`[Harvia] Temp-Soll -> ${value}°C`, 'info');
            // Sofortige Bestätigung im ioBroker
            setState(`${BASE_PATH}.targetTemp`, parseFloat(value), true);
            lastCommandTime = Date.now();
        }
    } catch (err) {
        const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;

        // "Device unavailable" ist ein Cloud-Sperr-Effekt bei schnellen Klicks.
        // Wir loggen das nur noch als Debug, um das Info-Log sauber zu halten.
        if (detail.includes('Device unavailable')) {
            log(`[Harvia] Cloud-Sperre: Gerät belegt, Befehl wird verworfen.`, 'debug');
        } else {
            log(`[Harvia] Fehler bei der Steuerung: ${detail}`, 'error');
            setState(`${BASE_PATH}.errorMsg`, `Fehler: ${err.message}`, true);
        }

        // RE-LOGIN LOGIK: Falls der Token während der Laufzeit ungültig wurde
        // Automatischer Re-Login bei abgelaufenem Token (HTTP 401)
        if (err.response && err.response.status === 401) {
            log('[Harvia] Token abgelaufen bei Steuerung, löse Re-Login aus...', 'warn');
            isSendingCommand = false; // Lock kurz lösen für den Login
            if (await login()) {
                // Nach erfolgreichem Login Befehl einmal wiederholen
                await setSaunaState(stateName, value, true);
            }
        }
    } finally {
        isSendingCommand = false;
    }
}

/**
 * Hilfsfunktion zum Auslesen von Werten aus der API-Antwort mit Fallbacks.
 * @param {object} p - Das Daten-Objekt von der API
 * @param {string[]} keys - Liste der möglichen Keys
 */
function getApiValue(p, keys) {
    // 1. Suche auf der obersten Ebene
    for (const key of keys) {
        if (p[key] !== undefined && p[key] !== null) return p[key];
    }
    // 2. Suche in einem evtl. vorhandenen 'status'-Objekt (neue Harvia API Struktur)
    if (p.status && typeof p.status === 'object') {
        for (const key of keys) {
            if (p.status[key] !== undefined && p.status[key] !== null) return p.status[key];
        }
    }
    return undefined;
}

function isHarviaTrue(val) {
    // Erweitert um 23 (Fenix Remote Ready Status)
    const trueValues = [1, 21, 23, '1', '21', '23', true, 'true', 'on', 'enabled', 'safe', 'ready', 'active', 'standby'];
    let checkVal = val;
    if (typeof val === 'string') checkVal = val.toLowerCase().trim();
    if (typeof val === 'number') checkVal = val;
    return trueValues.includes(checkVal);
}

/**
 * 5. DATEN-SYNCHRONISATION (updateStatus)
 * Ruft die Live-Daten (Telemetrie) regelmäßig über den Data-Service ab.
 */
async function updateStatus() {
    try {
        if (!idToken || !dataBaseUrl) {
            return; // Noch nicht bereit, aber finally sorgt für Neustart
        }

        const response = await client.get(`${dataBaseUrl}/data/latest-data?deviceId=${FIXED_ID}`, {
            headers: { 'Authorization': `Bearer ${idToken}`, 'x-harvia-partner-id': PARTNER_ID }
        });

        const p = response.data?.data;

        if (p) {
            if (Date.now() - lastCommandTime < LATENCY_MS) return;

            const heatKeys   = ['heatOn', 'heatState', 'heat', 'heater', 'heat_on', 'is_heating'];
            // onOffTrigger nach vorne, da safetyRelay bei Fenix oft 0 ist trotz Bereitschaft
            const remoteKeys = ['remoteControl', 'remoteReady', 'onOffTrigger', 'remote_control', 'remote_ready', 'is_remote_ready', 'safetyRelay', 'remoteControlState', 'remote', 'isRemoteReady', 'remoteStart', 'remoteStartEnabled', 'remoteReadyState'];
            const doorKeys   = ['doorSafetyState', 'doorSafety', 'door', 'door_closed', 'door_safety_state', 'door_safety'];
            const lightKeys  = ['lightOn', 'lightState', 'light', 'light_on'];

            const actualHeat  = getApiValue(p, heatKeys);
            const actualRem   = getApiValue(p, remoteKeys);
            const actualDoor  = getApiValue(p, doorKeys);

            // NORMALISIERUNG: Harvia nutzt je nach Modell 'temp' oder 'temperature' / 'target_temperature'.
            const currentTemp = getApiValue(p, ['temperature', 'temp', 'current_temperature', 'ambient_temperature']);
            if (currentTemp !== undefined) setState(`${BASE_PATH}.temp`, parseFloat(currentTemp), true);

            const panelTemp = getApiValue(p, ['panelTemp', 'panel_temperature']);
            if (panelTemp !== undefined) setState(`${BASE_PATH}.panelTemp`, parseFloat(panelTemp), true);

            // Normalisierung der Heizleistung (heaterPower vs power)
            const currentPower = getApiValue(p, ['heaterPower', 'power', 'heater_power']);
            if (currentPower !== undefined) setState(`${BASE_PATH}.heaterPower`, parseFloat(currentPower), true);

            const bathingHours = getApiValue(p, ['totalBathingHours', 'total_bathing_hours', 'bathing_hours']);
            if (bathingHours !== undefined) setState(`${BASE_PATH}.totalBathingHours`, parseFloat(bathingHours), true);

            const sessions = getApiValue(p, ['totalSessions', 'total_sessions', 'sessions']);
            if (sessions !== undefined) setState(`${BASE_PATH}.totalSessions`, parseInt(sessions), true);

            const operatingHours = getApiValue(p, ['totalOperatingHours', 'totalHours', 'total_hours', 'operating_hours']);
            if (operatingHours !== undefined) setState(`${BASE_PATH}.totalOperatingHours`, parseFloat(operatingHours), true);

            const tTemp = getApiValue(p, ['targetTemperature', 'targetTemp', 'target_temperature', 'setpoint_temperature']);
            if (tTemp !== undefined) setState(`${BASE_PATH}.targetTemp`, parseFloat(tTemp), true);

            // Heizung
            if (actualHeat !== undefined) {
                setState(`${BASE_PATH}.heatOn`, isHarviaTrue(actualHeat), true);
            } else if (p.online) {
                setState(`${BASE_PATH}.heatOn`, false, true);
            }

            // Licht
            const actualLight = getApiValue(p, lightKeys);
            if (actualLight !== undefined) {
                setState(`${BASE_PATH}.lightOn`, isHarviaTrue(actualLight), true);
            } else if (p.online) {
                setState(`${BASE_PATH}.lightOn`, false, true);
            }

            // Fernstart-Bereitschaft (Wurde die Sicherheitskette am Panel quittiert?)
            if (actualRem !== undefined) {
                setState(`${BASE_PATH}.remoteControl`, isHarviaTrue(actualRem), true);
            }

            // Tür-Sicherheit
            if (actualDoor !== undefined) {
                setState(`${BASE_PATH}.doorSafety`, isHarviaTrue(actualDoor), true);
            }
            setState(`${BASE_PATH}.online`, true, true);
        }
    } catch (err) {
        if (err.response && err.response.status === 401) {
            log('[Harvia] Token abgelaufen, versuche Re-Login...', 'warn');
            await login();
        } else {
            log(`[Harvia] Abruf-Fehler: ${err.message}`, 'error');
            setState(`${BASE_PATH}.online`, false, true);
        }
    } finally {
        setTimeout(updateStatus, REFRESH_MS);
    }
}

/**
 * 6. IOBROKER-EVENT-LISTENER (setupListeners) -> NEU!
 * Überwacht Änderungen der Datenpunkte im ioBroker.
 * Wichtig: Reagiert nur auf ack:false (Benutzereingabe), nicht auf Skript-Updates (ack:true).
 */
function setupListeners() {
    // Interne Hilfsfunktion zur Entprellung von ioBroker-Events (Race Condition Schutz)
    function shouldProcess(id) {
        const now = Date.now();
        if (lastEventTime[id] && (now - lastEventTime[id] < 1500)) {
            return false; // Ignoriere Events innerhalb von 1500ms (VIS-Prellen)
        }
        lastEventTime[id] = now;
        return true;
    }

    on({ id: `${BASE_PATH}.heatOn`, change: 'ne', ack: false }, async (obj) => {
        if (!shouldProcess(obj.id)) return;
        // Konvertierung sicherstellen (VIS sendet oft Strings)
        const val = obj.state.val === true || obj.state.val === 'true' || obj.state.val === 1;

        // PRÜFUNG: Fernstart-Bereitschaft
        const isRemoteReady = getState(`${BASE_PATH}.remoteControl`).val;

        if (val && !isRemoteReady) {
            const msg = 'Fernstart am Panel nicht bereit!';
            log(`[Harvia] ${msg}`, 'warn');
            setState(`${BASE_PATH}.errorMsg`, msg, true);
            // Schalter in VIS sofort wieder auf aus setzen (ack:true)
            setState(`${BASE_PATH}.heatOn`, false, true);
        } else {
            setState(`${BASE_PATH}.errorMsg`, '', true); // Bestehende Fehler löschen
            await setSaunaState('heatOn', val);
        }
    });

    // Event-Trigger für Licht an/aus
    on({ id: `${BASE_PATH}.lightOn`, change: 'ne', ack: false }, async (obj) => {
        if (!shouldProcess(obj.id)) return;
        const val = obj.state.val === true || obj.state.val === 'true' || obj.state.val === 1;
        await setSaunaState('lightOn', val);
    });

    // Event-Trigger für Änderung der Zieltemperatur
    on({ id: `${BASE_PATH}.targetTemp`, change: 'ne', ack: false }, async (obj) => {
        if (!shouldProcess(obj.id)) return;
        await setSaunaState('targetTemp', obj.state.val);
    });

    // 10-Minuten-Benachrichtigung (Fenix-Logik: Zieltemperatur - 13°C)
    on({ id: `${BASE_PATH}.temp`, change: 'ne', ack: true }, (obj) => {
        const currentTemp = obj.state.val;
        const targetTemp = getState(`${BASE_PATH}.targetTemp`).val;
        const heatOn = getState(`${BASE_PATH}.heatOn`).val;
        const notified = getState(`${BASE_PATH}.readyNotified`).val;

        // Wenn Heizung an ist, noch nicht benachrichtigt wurde und die Temperatur 13°C vor dem Ziel ist.
        // Die "currentTemp > 20" Prüfung verhindert Fehlalarme bei extrem niedrigen Test-Zieltemperaturen.
        if (heatOn && !notified && currentTemp > 20 && currentTemp >= (targetTemp - 13)) {
            setState(`${BASE_PATH}.readyNotified`, true, true);

            const msg = `🧖 Die Sauna erreicht in ca. 10 Minuten ihre Zieltemperatur (${targetTemp}°C).`;
            log(`[Harvia] ${msg}`, 'info');

            if (typeof sendGlobalNotify === 'function') sendGlobalNotify(msg, "Sauna", 1);
        }
    });

    // Reset der Benachrichtigungssperre, wenn die Heizung an- oder ausgeschaltet wird
    on({ id: `${BASE_PATH}.heatOn`, change: 'ne' }, () => {
        setState(`${BASE_PATH}.readyNotified`, false, true);
    });
}

/**
 * Hilfsfunktion für den Cloud-Connect Loop
 * Trennt die einmalige Initialisierung von der wiederkehrenden Login-Logik.
 */
async function startCloudConnection() {
    if (await login()) {
        await updateStatus(); // Ersten Poll starten
        // Token-Refresh-Intervall einrichten
        setInterval(async () => {
            await login();
        }, LOGIN_REFRESH);
    } else {
        log('[Harvia] Login fehlgeschlagen. Versuche es in 5 Minuten erneut...', 'warn');
        setTimeout(startCloudConnection, 5 * 60 * 1000);
    }
}

/**
 * 7. HAUPTPROGRAMM (main)
 * Startet die Initialisierung und Abläufe.
 */
async function main() {
    log('[Harvia] Skript-Start: Initialisierung läuft...', 'info');

    await ensureStatesExist(); // 1. Datenpunkte anlegen

    // 2. CLEAN START: Alle Status-Werte beim Start auf 'false' setzen,
    // um keine veralteten Werte anzuzeigen, bevor der erste Cloud-Poll durch ist.
    setState(`${BASE_PATH}.online`, false, true);
    setState(`${BASE_PATH}.heatOn`, false, true);
    setState(`${BASE_PATH}.lightOn`, false, true);
    setState(`${BASE_PATH}.doorSafety`, false, true);
    setState(`${BASE_PATH}.remoteControl`, false, true);
    setState(`${BASE_PATH}.readyNotified`, false, true);

    setupListeners();          // 3. Auf Klicks in VIS warten

    // 4. Cloud-Verbindung starten
    await startCloudConnection();
}

// Skript-Start ausführen
main();
