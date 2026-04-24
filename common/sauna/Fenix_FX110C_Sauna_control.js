/**
 * ioBroker Script: Harvia Fenix FX 110C
 * -----------------------------------------------------------------------------
 * LOGIK-ÜBERSICHT:
 * Das Skript arbeitet nach dem Prinzip "Abfragen -> Auswerten -> Visualisieren".
 * Es agiert als Brücke zwischen der Harvia-Cloud und dem ioBroker-System.
 */

// --- KONFIGURATION & GLOBALE VARIABLEN ---
const BASE_PATH      = '0_userdata.0.Energie.Sauna'; // Speicherort der Datenpunkte
const axios          = require('axios');             // Bibliothek für HTTP-Anfragen (Kommunikation mit dem Web)
const REFRESH_MS     = 60 * 1000;                    // Aktualisierungsrate (60 Sekunden)
const LOGIN_REFRESH  = 50 * 60 * 1000;               // Token-Erneuerung (50 Minuten)

// Identifikations-Daten: Diese sind fest mit deinem Sauna-Account verknüpft.
const CLIENT_ID      = '24emhb2mm0v4sscqhbdev86b2v';
const FIXED_ID       = '73293847-550d-40da-8bcf-3d6e2fcf5add';
const PARTNER_ID     = 'ORG/prod:0:6656:0';

const client = axios.create({ timeout: 10000 });     // Axios-Instanz mit 10s Timeout

// Zwischenspeicher für die Sitzung:
let idToken      = ''; // Das "Ticket", das wir beim Login bekommen und bei jeder Anfrage vorzeigen.
let dataBaseUrl  = ''; // Die dynamische Adresse des Servers, der unsere Daten bereitstellt.
let authUrl      = ''; // Die Adresse für die Anmeldung.
let isLoggingIn  = false; // Verhindert doppelte Login-Versuche (Race Condition Schutz)

/**
 * 1. INITIALISIERUNG (ensureStatesExist)
 * Hier stellen wir sicher, dass in ioBroker alle "Schubladen" vorhanden sind.
 * Wenn du das Skript startest, baut es die Struktur auf, falls sie leer ist.
 */
async function ensureStatesExist() {
    const states = [
        { id: 'user',               type: 'string',  role: 'text',          def: '' },
        { id: 'password',           type: 'string',  role: 'text',          def: '' },
        { id: 'online',             type: 'boolean', role: 'indicator.reachable', def: false },
        { id: 'heatOn',             type: 'boolean', role: 'switch.power', def: false },
        { id: 'lightOn',            type: 'boolean', role: 'switch.light', def: false },
        { id: 'temp',               type: 'number',  role: 'value.temperature', unit: '°C', def: 0 },
        { id: 'panelTemp',          type: 'number',  role: 'value.temperature', unit: '°C', def: 0 },
        { id: 'heaterPower',        type: 'number',  role: 'value.power', unit: 'W', def: 0 },
        // Wir nutzen hier 'value.number', damit ioBroker diese Werte nicht als Uhrzeit interpretiert.
        { id: 'totalBathingHours',  type: 'number',  role: 'value.number', unit: 'h', def: 0 },
        { id: 'totalOperatingHours',type: 'number',  role: 'value.number', unit: 'h', def: 0 },
        { id: 'totalSessions',      type: 'number',  role: 'value.number', def: 0 },
        { id: 'targetTemp',         type: 'number',  role: 'level.temperature', unit: '°C', def: 90 },
        { id: 'doorSafety',         type: 'boolean', role: 'indicator.safety', def: true }
    ];
    for (const s of states) {
        await createStateAsync(`${BASE_PATH}.${s.id}`, s.def, {
            name: s.id, type: s.type, role: s.role, unit: s.unit, read: true, write: true
        });
    }
}

/**
 * 2. KONFIGURATION LADEN (fetchConfig)
 * Harvia verteilt Daten auf verschiedene Server. Diese Funktion fragt global nach,
 * welche Server-Adresse (URL) gerade für unsere Sauna-ID gültig ist.
 */
async function fetchConfig() {
    try {
        const response = await client.get("https://api.harvia.io/endpoints");
        dataBaseUrl = response.data.endpoints.RestApi.data.https;
        authUrl = `${response.data.endpoints.RestApi.generics.https}/auth/token`;
        return true;
    } catch (err) {
        log(`[Harvia] Fehler beim Laden der API-Konfiguration: ${err.message}`, 'error');
        return false;
    }
}

/**
 * 3. ANMELDUNG (login)
 * Hier schicken wir deinen User/Passwort aus den ioBroker-Objekten an Harvia.
 * Als Antwort bekommen wir ein 'idToken'. Das ist unser digitaler Ausweis für
 * alle weiteren Anfragen.
 */
async function login() {
    if (isLoggingIn) return false; // Bereits ein Login-Prozess aktiv
    isLoggingIn = true;

    const user = getState(`${BASE_PATH}.user`).val;
    const pass = getState(`${BASE_PATH}.password`).val;

    if (!user || !pass) {
        log('[Harvia] Login fehlgeschlagen: Benutzername oder Passwort in Objekten nicht gesetzt!', 'warn');
        isLoggingIn = false;
        return false;
    }

    try {
        // Vor dem Login sicherstellen, dass wir die aktuellen Endpunkte haben
        if (!(await fetchConfig())) {
            log('[Harvia] Login abgebrochen: Konfiguration konnte nicht geladen werden.', 'warn');
            return false;
        }

        const response = await client.post(authUrl, {
            username: user, password: pass, client_id: CLIENT_ID
        });
        idToken = response.data.idToken;
        log('[Harvia] Login erfolgreich, Token erhalten.', 'info');
        return true;
    } catch (err) {
        log(`[Harvia] Login fehlgeschlagen: ${err.message}`, 'error');
        return false;
    } finally {
        isLoggingIn = false;
    }
}

/**
 * 4. DATEN-SYNCHRONISATION (updateStatus)
 * Das Herz des Skripts. Es ruft die Live-Daten ab.
 */
async function updateStatus() {
    if (!idToken || !dataBaseUrl) return; // Ohne Token keine Anfrage
    try {
        // GET-Request mit dem 'idToken' im Header (der Ausweis).
        const response = await client.get(`${dataBaseUrl}/data/latest-data?deviceId=${FIXED_ID}`, {
            headers: { 'Authorization': `Bearer ${idToken}`, 'x-harvia-partner-id': PARTNER_ID }
        });

        const p = response.data?.data; // 'p' enthält das JSON-Paket vom Server
        if (p) {
            // Verteilung der Daten in die ioBroker-Objekt-Struktur
            if (p.temp !== undefined) setState(`${BASE_PATH}.temp`, parseFloat(p.temp), true);
            if (p.panelTemp !== undefined) setState(`${BASE_PATH}.panelTemp`, parseFloat(p.panelTemp), true);
            if (p.heaterPower !== undefined) setState(`${BASE_PATH}.heaterPower`, parseFloat(p.heaterPower), true);
            if (p.totalBathingHours !== undefined) setState(`${BASE_PATH}.totalBathingHours`, parseFloat(p.totalBathingHours), true);
            if (p.totalSessions !== undefined) setState(`${BASE_PATH}.totalSessions`, parseInt(p.totalSessions), true);
            if (p.totalHours !== undefined) setState(`${BASE_PATH}.totalOperatingHours`, parseFloat(p.totalHours), true);
            if (p.targetTemp !== undefined) setState(`${BASE_PATH}.targetTemp`, parseFloat(p.targetTemp), true);
            setState(`${BASE_PATH}.heatOn`, !!(p.heatOn === 1 || p.heatOn === true), true);
            setState(`${BASE_PATH}.lightOn`, !!(p.lightOn === 1 || p.lightOn === true), true);
            setState(`${BASE_PATH}.doorSafety`, p.doorSafetyState === 1, true);
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
        // Rekursiver Aufruf statt festem Intervall verhindert Überlappung
        setTimeout(updateStatus, REFRESH_MS);
    }
}

/**
 * 5. HAUPTPROGRAMM (main)
 * Hier wird alles nacheinander gestartet.
 */
async function main() {
    log('[Harvia] Skript-Initialisierung...', 'info');
    await ensureStatesExist(); // Schritt 1: Schubladen vorbereiten

    if (await login()) { // Schritt 2: Einloggen (fetchConfig ist nun im login integriert)
        await updateStatus(); // Schritt 3: Erster Datendurchlauf

        // Token-Refresh Intervall
        setInterval(async () => {
            await login();
        }, LOGIN_REFRESH);
    } else {
        log('[Harvia] Initialer Login fehlgeschlagen. Starte neuen Versuch in 5 Minuten...', 'warn');
        setTimeout(main, 5 * 60 * 1000);
    }
}
main();
