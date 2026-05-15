/**
 * ioBroker Script: Harvia Fenix FX 110C
 * -----------------------------------------------------------------------------
 * LOGIK-ÜBERSICHT: Das Skript dient der reinen Überwachung der Sauna.
 * Es fragt regelmäßig (60s) Live-Daten von der Harvia-Cloud ab
 * und aktualisiert die entsprechenden ioBroker-Datenpunkte.
 */

// --- KONFIGURATION & GLOBALE VARIABLEN ---
const BASE_PATH      = '0_userdata.0.Energie.Sauna'; // Speicherort der Datenpunkte
const axios          = require('axios');             // Bibliothek für HTTP-Anfragen (Kommunikation mit dem Web)
const aws4           = require('aws4');              // Für AWS Signature V4
const { URL }        = require('url');               // Hilfsklasse zum Parsen von URLs
const REFRESH_MS     = 60 * 1000;                    // Aktualisierungsrate (60 Sekunden)
const LOGIN_REFRESH  = 50 * 60 * 1000;               // Token-Erneuerung (50 Minuten)

// Um Steuerbefehle an die Harvia Cloud zu senden, benötigt die API eine AWS Signature V4.
// Dies erfordert die Installation externer Node.js-Module im ioBroker JavaScript Adapter.
// Führe folgende Befehle auf deinem ioBroker-Host aus (im ioBroker Installationsverzeichnis):
// cd /opt/iobroker/node_modules/iobroker.javascript
// npm install aws-sdk aws4
// Starte anschließend die JavaScript-Adapter-Instanz neu.
// Identifikations-Daten: Diese sind fest mit deinem Sauna-Account verknüpft.
const CLIENT_ID      = '24emhb2mm0v4sscqhbdev86b2v';
const FIXED_ID       = '73293847-550d-40da-8bcf-3d6e2fcf5add';
const PARTNER_ID     = 'ORG/prod:4'; // Standard Fallback für Harvia Cloud v6

const client = axios.create({ timeout: 20000 });     // Axios-Instanz mit 20s Timeout

// Zwischenspeicher für die Sitzung:
let idToken      = ''; // Das "Ticket", das wir beim Login bekommen und bei jeder Anfrage vorzeigen.
let dataBaseUrl  = ''; // Die dynamische Adresse des Servers, der unsere Daten bereitstellt.
let controlBaseUrl = ''; // Die Basis-Adresse für Steuerbefehle
let partnerId    = PARTNER_ID;
let authUrl      = ''; // Die Adresse für die Anmeldung.
let isLoggingIn  = false; // Verhindert doppelte Login-Versuche (Race Condition Schutz)
let userPoolId   = '';
let identityPoolId = '';
// Die AWS-Region wird aus der API-Konfiguration gelesen.
let region       = 'eu-central-1';
// Temporäre AWS-Credentials für die Signatur (werden nach Login abgerufen)
let awsAccessKeyId = '';
let awsSecretAccessKey = '';
let awsSessionToken = '';

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
        const data = response.data;

        // Rekursive Hilfsfunktion: Sucht einen Key tief im Objektbaum.
        // Damit sind wir immun gegen Änderungen der Verschachtelungstiefe durch Harvia.
        const findVal = (obj, key) => {
            if (!obj || typeof obj !== 'object') return undefined;
            if (key in obj) return obj[key];
            for (let k in obj) {
                let res = findVal(obj[k], key);
                if (res !== undefined) return res;
            }
            return undefined;
        };

        // Wir extrahieren die kritischen IDs durch Durchsuchen des gesamten Antwort-Baums.
        userPoolId     = findVal(data, 'UserPoolId') || '';
        identityPoolId = findVal(data, 'IdentityPoolId') || '';
        region         = findVal(data, 'Region') || 'eu-central-1';
        partnerId      = findVal(data, 'PartnerOrganizationId') || PARTNER_ID;

        // Die URLs liegen normalerweise unter endpoints.RestApi
        const eps = data.endpoints?.RestApi || findVal(data, 'RestApi');
        if (eps && eps.data && eps.generics) {
            dataBaseUrl = eps.data.https;
            controlBaseUrl = eps.generics.https;
            authUrl = `${eps.generics.https}/auth/token`;
        } else {
            throw new Error('API-Endpunkte (RestApi) konnten nicht lokalisiert werden.');
        }

        //log(`[Harvia] API-Konfiguration geladen (Region: ${region}, Partner: ${partnerId}, IdentityPool: ${identityPoolId})`, 'info');

        if (!identityPoolId || !userPoolId) {
            log(`[Harvia] Kritischer Fehler: IdentityPoolId oder UserPoolId fehlen in der API-Antwort!`, 'error');
            return false;
        }

        return true;
    } catch (err) {
        log(`[Harvia] Fehler beim Laden der API-Konfiguration: ${err.message}`, 'error');
        return false; // Ohne Config kein Login möglich
    }
}

/**
 * 2.5 AWS CREDENTIALS ABRUFEN (getAwsCredentials)
 * Tauscht das idToken gegen temporäre AWS Keys für die Signatur.
 */
async function getAwsCredentials() {
    const cognitoUrl = `https://cognito-identity.${region}.amazonaws.com/`;
    const loginProvider = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    try {
        // 1. Identity ID abrufen
        const resId = await client.post(cognitoUrl, {
            IdentityPoolId: identityPoolId,
            Logins: { [loginProvider]: idToken }
        }, { headers: { 'X-Amz-Target': 'AWSCognitoIdentityService.GetId', 'Content-Type': 'application/x-amz-json-1.1' } });

        const identityId = resId.data.IdentityId;

        // 2. Temporäre Credentials abrufen
        const resCreds = await client.post(cognitoUrl, {
            IdentityId: identityId,
            Logins: { [loginProvider]: idToken }
        }, { headers: { 'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity', 'Content-Type': 'application/x-amz-json-1.1' } });

        const creds = resCreds.data.Credentials;
        awsAccessKeyId = creds.AccessKeyId;
        awsSecretAccessKey = creds.SecretKey;
        awsSessionToken = creds.SessionToken;

        //log(`[Harvia] AWS Credentials erfolgreich für Region ${region} abgerufen.`, 'info');
        return true;
    } catch (err) {
        const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
        log(`[Harvia] Fehler beim AWS Credential-Abruf: ${detail}`, 'error');
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
            log('[Harvia] Login abgebrochen: Konfiguration konnte nicht geladen werden', 'warn');
            return false;
        }

        const response = await client.post(authUrl, {
            username: user, password: pass, client_id: CLIENT_ID
        });
        idToken = response.data.idToken;

        // Nach dem Login sofort die AWS Keys für die Steuerung holen
        if (!(await getAwsCredentials())) {
            log('[Harvia] AWS Security-Check fehlgeschlagen. Steuerung wird nicht funktionieren.', 'warn');
        }
        //log('[Harvia] Login erfolgreich, Token erhalten.', 'info');
        return true;
    } catch (err) {
        log(`[Harvia] Login fehlgeschlagen: ${err.message}`, 'error');
        return false;
    } finally {
        isLoggingIn = false;
    }
}

/**
 * Sends a command to the Harvia API to change a sauna setting.
 * @param {string} stateName - The name of the state to change (e.g., 'lightOn', 'heatOn', 'targetTemp').
 * @param {any} value - The new value for the state.
 */
async function setSaunaState(stateName, value) {
    if (!idToken || !controlBaseUrl) {
        log(`[Harvia] Befehl '${stateName}' kann nicht gesendet werden: Token oder controlBaseUrl fehlen.`, 'warn');
        return;
    }

    // Konvertierung für Harvia API (1 für an, 0 für aus)
    const apiValue = (typeof value === 'boolean') ? (value ? 1 : 0) : value;

    const payload = {};
    payload[stateName] = apiValue;

    // URL parsen für das AWS-Signing
    const urlObj = new URL(controlBaseUrl);
    const path = `${urlObj.pathname}/control/deviceId/${FIXED_ID}`;

    // Das Request-Objekt für aws4 vorbereiten
    const requestOptions = {
        host: urlObj.host,
        path: path,
        method: 'POST',
        body: JSON.stringify(payload),
        region: region,
        service: 'execute-api',
        headers: {
            'Content-Type': 'application/json',
            'x-harvia-partner-id': partnerId
        }
    };

    // Die Anfrage mit den temporären Keys signieren
    aws4.sign(requestOptions, {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        sessionToken: awsSessionToken
    });

    try {
        await axios.post(`https://${requestOptions.host}${requestOptions.path}`, requestOptions.body, { headers: requestOptions.headers });
        //log(`[Harvia] Befehl '${stateName}' (${apiValue}) erfolgreich gesendet.`, 'info');
    } catch (err) {
        const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
        log(`[Harvia] Steuerungsfehler '${stateName}': ${detail}`, 'error');

        if (err.response && err.response.status === 401) {
            log('[Harvia] Token abgelaufen bei Steuerung, löse Re-Login aus...', 'warn');
            await login();
        }
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
            headers: { 'Authorization': `Bearer ${idToken}`, 'x-harvia-partner-id': partnerId }
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
 * 4.5 STEUERUNGS-TRIGGER (initListeners)
 * Reagiert auf manuelle Änderungen der Datenpunkte in ioBroker.
 */
function initListeners() {
    const controlStates = [
        { id: 'heatOn',     api: 'heatOn' },
        { id: 'lightOn',    api: 'lightOn' },
        { id: 'targetTemp', api: 'targetTemp' }
    ];

    controlStates.forEach(state => {
        on({ id: `${BASE_PATH}.${state.id}`, change: 'ne', ack: false }, async (obj) => {
            log(`[Harvia] Manueller Steuerungsbefehl erkannt: ${state.id} -> ${obj.state.val}`);
            await setSaunaState(state.api, obj.state.val);

            // Wir setzen den Wert nach dem Senden NICHT sofort auf ack:true,
            // da wir auf die Bestätigung beim nächsten Cloud-Poll warten.
        });
    });
}

/**
 * 5. HAUPTPROGRAMM (main)
 * Hier wird alles nacheinander gestartet.
 */
async function main() {
    log('[Harvia] Skript-Initialisierung', 'info');
    await ensureStatesExist(); // Schritt 1: Schubladen vorbereiten

    if (await login()) { // Schritt 2: Einloggen (fetchConfig ist nun im login integriert)
        initListeners();      // Schritt 2.5: Auf Benutzereingaben reagieren
        await updateStatus(); // Schritt 3: Erster Datendurchlauf

        // Token-Refresh Intervall
        setInterval(async () => {
            await login();
        }, LOGIN_REFRESH);
    } else {
        log('[Harvia] Initialer Login fehlgeschlagen. Starte neuen Versuch in 5 Minuten', 'warn');
        setTimeout(main, 5 * 60 * 1000);
    }
}
main();
