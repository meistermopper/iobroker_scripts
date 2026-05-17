/**
 * ioBroker Script: Harvia Fenix FX 110C (inkl. Remote-Steuerung)
 * -----------------------------------------------------------------------------
 * LOGIK-ÜBERSICHT: Das Skript überwacht nicht nur die Live-Daten der Sauna,
 * sondern ermöglicht auch die vollständige Steuerung (Heizung, Licht, Temperatur)
 * über die offiziellen REST-API-Endpunkte des Harvia Device Service./
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
        { id: 'remoteControl',      type: 'boolean', role: 'indicator.state',       def: false }
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
        log(`[Harvia] Fehler beim Laden der API-Konfiguration: ${err.message}. Nutze Fallback-URLs.`, 'warn');
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
 */
async function setSaunaState(stateName, value) {
    if (!idToken || !deviceBaseUrl) {
        log(`[Harvia] Abbruch: Noch nicht eingeloggt oder Endpunkte unbekannt.`, 'warn');
        return;
    }

    try {
        // TYP A: Schaltsignale (Licht/Heizung) via POST
        if (stateName === 'heatOn' || stateName === 'lightOn') {
            const commandType = stateName === 'heatOn' ? 'SAUNA' : 'LIGHTS';
            const stateStr = value ? 'on' : 'off';

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
                log(`[Harvia] Befehl '${commandType}' erfolgreich auf '${stateStr}' gesetzt.`, 'info');

                // BESTÄTIGUNG: Wir setzen ack: true sofort, damit die UI nicht "springt"
                setState(`${BASE_PATH}.${stateName}`, value, true);

                lastCommandTime = Date.now(); // Timestamp für Latenz-Schutz setzen
            } else {
                const reason = response.data ? response.data.failureReason : 'Unbekannt';
                log(`[Harvia] Cloud lehnt Befehl ab: ${reason}`, 'warn');
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
            log(`[Harvia] Zieltemperatur auf ${value}°C geändert.`, 'info');
            // Sofortige Bestätigung im ioBroker
            setState(`${BASE_PATH}.targetTemp`, parseFloat(value), true);
            lastCommandTime = Date.now();
        }
    } catch (err) {
        const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;

        // RE-LOGIN LOGIK: Falls der Token während der Laufzeit ungültig wurde
        // Automatischer Re-Login bei abgelaufenem Token (HTTP 401)
        if (err.response && err.response.status === 401) {
            log('[Harvia] Token abgelaufen bei Steuerung, löse Re-Login aus...', 'warn');
            if (await login()) {
                // Nach erfolgreichem Login Befehl einmal wiederholen
                await setSaunaState(stateName, value);
            }
        }
    }
}

/**
 * 5. DATEN-SYNCHRONISATION (updateStatus)
 * Ruft die Live-Daten (Telemetrie) regelmäßig über den Data-Service ab.
 */
async function updateStatus() {
    if (!idToken || !dataBaseUrl) return;
    try {
        const response = await client.get(`${dataBaseUrl}/data/latest-data?deviceId=${FIXED_ID}`, {
            headers: { 'Authorization': `Bearer ${idToken}`, 'x-harvia-partner-id': PARTNER_ID }
        });

        const p = response.data?.data;

        // Debug-Log für Sicherheitszustände (hilft bei der Analyse von Sensor-Problemen)
        if (p && (p.doorSafetyState !== undefined || p.remoteControlState !== undefined)) {
            // log(`[Harvia] Rohdaten - Tür-Sensor: ${p.doorSafetyState}, Fernstart-Modus: ${p.remoteControlState}`, 'debug');
        }

        if (p) {
            // LATENZ-SCHUTZ:
            // Die Cloud braucht oft Zeit, um den Status zu aktualisieren. Wenn wir vor weniger
            // als 5s einen Befehl gesendet haben, ignorieren wir dieses Update, um zu
            // verhindern, dass der Schalter in der VIS kurz zurückspringt.
            if (Date.now() - lastCommandTime < LATENCY_MS) return;

            // NORMALISIERUNG: Harvia nutzt je nach Modell 'temp' oder 'temperature'.
            const currentTemp = p.temperature !== undefined ? p.temperature : p.temp;

            if (currentTemp !== undefined) setState(`${BASE_PATH}.temp`, parseFloat(currentTemp), true);
            if (p.panelTemp !== undefined) setState(`${BASE_PATH}.panelTemp`, parseFloat(p.panelTemp), true);
            if (p.heaterPower !== undefined) setState(`${BASE_PATH}.heaterPower`, parseFloat(p.heaterPower), true);
            if (p.totalBathingHours !== undefined) setState(`${BASE_PATH}.totalBathingHours`, parseFloat(p.totalBathingHours), true);
            if (p.totalSessions !== undefined) setState(`${BASE_PATH}.totalSessions`, parseInt(p.totalSessions), true);
            if (p.totalHours !== undefined) setState(`${BASE_PATH}.totalOperatingHours`, parseFloat(p.totalHours), true);

            const tTemp = p.targetTemperature !== undefined ? p.targetTemperature : p.targetTemp;
            if (tTemp !== undefined) setState(`${BASE_PATH}.targetTemp`, parseFloat(tTemp), true);

            // STATUS-FIX (Licht/Heizung):
            // Wir werten NUR Felder mit "State" am Ende aus. Felder wie 'light' oder 'heat'
            // ohne "State" geben oft nur an, ob das Gerät die Funktion ÜBERHAUPT hat.
            const actualHeat  = p.heatState;
            const actualLight = p.lightState;

            // Umrechnung von 0/1 oder "on"/"off" in echtes Boolean für ioBroker
            if (actualHeat !== undefined) setState(`${BASE_PATH}.heatOn`,  !!(actualHeat === 1  || actualHeat === true  || actualHeat === 'on'),  true);
            if (actualLight !== undefined) setState(`${BASE_PATH}.lightOn`, !!(actualLight === 1 || actualLight === true || actualLight === 'on'), true);

            // Fernstart-Bereitschaft (Wurde die Sicherheitskette am Panel quittiert?)
            if (p.remoteControlState !== undefined) {
                setState(`${BASE_PATH}.remoteControl`, p.remoteControlState === 1, true);
            }

            setState(`${BASE_PATH}.doorSafety`, p.doorSafetyState === 1, true); // 1 = Sicher/Zu
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
    on({ id: `${BASE_PATH}.heatOn`, change: 'ne', ack: false }, async (obj) => {
        log(`[Harvia] ioBroker-Trigger: Sauna-Heizung wird auf '${obj.state.val}' gesetzt.`, 'info');
        await setSaunaState('heatOn', obj.state.val);
    });

    // Event-Trigger für Licht an/aus
    on({ id: `${BASE_PATH}.lightOn`, change: 'ne', ack: false }, async (obj) => {
        log(`[Harvia] ioBroker-Trigger: Saunalicht wird auf '${obj.state.val}' gesetzt.`, 'info');
        await setSaunaState('lightOn', obj.state.val);
    });

    // Event-Trigger für Änderung der Zieltemperatur
    on({ id: `${BASE_PATH}.targetTemp`, change: 'ne', ack: false }, async (obj) => {
        log(`[Harvia] ioBroker-Trigger: Zieltemperatur wird auf ${obj.state.val}°C geändert.`, 'info');
        await setSaunaState('targetTemp', obj.state.val);
    });
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

    setupListeners();          // 3. Auf Klicks in VIS warten

    if (await login()) {       // 3. Cloud-Verbindung herstellen
        await updateStatus();  // Schritt 4: Ersten Datendurchlauf starten

        // Token-Refresh-Intervall einrichten
        setInterval(async () => {
            await login();
        }, LOGIN_REFRESH);
    } else {
        log('[Harvia] Initialer Login fehlgeschlagen. Starte neuen Versuch in 5 Minuten', 'warn');
        setTimeout(main, 5 * 60 * 1000);
    }
}

// Skript-Start ausführen
main();
