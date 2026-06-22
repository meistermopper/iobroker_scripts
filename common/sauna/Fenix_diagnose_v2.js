/**
 * ioBroker Script: Harvia Fenix API Diagnostik v2
 * -----------------------------------------------------------------------------
 * Führt Anfragen an verschiedene Endpunkte der Harvia API aus, um herauszufinden,
 * wo der reale Remote-Status und Tür-Status übertragen werden.
 */

const BASE_PATH       = '0_userdata.0.Energie.Sauna'; 
const axios           = require('axios');             

const CLIENT_ID       = '24emhb2mm0v4sscqhbdev86b2v';
const FIXED_ID        = '73293847-550d-40da-8bcf-3d6e2fcf5add'; 
const PARTNER_ID      = 'ORG/prod:0:6656:0';                    

const client = axios.create({ timeout: 15000 });     

let idToken        = ''; 
let dataBaseUrl    = ''; 
let deviceBaseUrl  = '';
let authUrl        = ''; 

async function fetchConfig() {
    try {
        const response = await client.get("https://api.harvia.io/endpoints");
        const ep = response.data.endpoints.RestApi;
        dataBaseUrl = ep.data.https;
        deviceBaseUrl = ep.device.https;
        authUrl = `${ep.generics.https}/auth/token`;
        return true;
    } catch (err) {
        log(`[Harvia-Diag] Fehler beim Laden der API-Konfiguration: ${err.message}`, 'warn');
        return false;
    }
}

async function login() {
    const user = getState(`${BASE_PATH}.user`).val;
    const pass = getState(`${BASE_PATH}.password`).val;

    if (!user || !pass) {
        log('[Harvia-Diag] Login-Fehler: Benutzerdaten in 0_userdata fehlen!', 'warn');
        return false;
    }

    try {
        if (!(await fetchConfig())) return false;
        const response = await client.post(authUrl, {
            username: user, password: pass, client_id: CLIENT_ID
        });
        idToken = response.data.idToken;
        log('[Harvia-Diag] Login erfolgreich!', 'info');
        return true;
    } catch (err) {
        log(`[Harvia-Diag] Login fehlgeschlagen: ${err.message}`, 'error');
        return false;
    }
}

async function runDiagnosis() {
    try {
        log(`[Harvia-Diag] Starte API-Abfragen für Device ID: ${FIXED_ID}...`, 'info');

        const headers = {
            'Authorization': `Bearer ${idToken}`,
            'x-harvia-partner-id': PARTNER_ID
        };

        // 1. Endpunkt: GET /data/latest-data?deviceId=...
        try {
            const resData = await client.get(`${dataBaseUrl}/data/latest-data?deviceId=${FIXED_ID}`, { headers });
            log(`[Harvia-Diag] Endpunkt /data/latest-data Antwort:\n${JSON.stringify(resData.data)}`, 'info');
        } catch (err) {
            log(`[Harvia-Diag] Fehler bei /data/latest-data: ${err.message}`, 'warn');
        }

        // 2. Endpunkt: GET /devices/state?deviceId=...
        try {
            const resState1 = await client.get(`${deviceBaseUrl}/devices/state?deviceId=${FIXED_ID}`, { headers });
            log(`[Harvia-Diag] Endpunkt /devices/state?deviceId=... Antwort:\n${JSON.stringify(resState1.data)}`, 'info');
        } catch (err) {
            log(`[Harvia-Diag] Fehler bei /devices/state?deviceId=...: ${err.message}`, 'warn');
        }

        // 3. Endpunkt: GET /devices/FIXED_ID/state
        try {
            const resState2 = await client.get(`${deviceBaseUrl}/devices/${FIXED_ID}/state`, { headers });
            log(`[Harvia-Diag] Endpunkt /devices/${FIXED_ID}/state Antwort:\n${JSON.stringify(resState2.data)}`, 'info');
        } catch (err) {
            log(`[Harvia-Diag] Fehler bei /devices/${FIXED_ID}/state: ${err.message}`, 'warn');
        }

        // 4. Endpunkt: GET /devices (Liste aller Geräte)
        try {
            const resDevices = await client.get(`${deviceBaseUrl}/devices`, { headers });
            log(`[Harvia-Diag] Endpunkt /devices Antwort:\n${JSON.stringify(resDevices.data)}`, 'info');
        } catch (err) {
            log(`[Harvia-Diag] Fehler bei /devices: ${err.message}`, 'warn');
        }

    } catch (e) {
        log(`[Harvia-Diag] Allgemeiner Diagnosefehler: ${e.message}`, 'error');
    }
}

async function main() {
    log('[Harvia-Diag] Starte Diagnose-Skript...', 'info');
    if (await login()) {
        await runDiagnosis();
    }
}

main();
