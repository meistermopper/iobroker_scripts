/**
 * ioBroker Script: Harvia Fenix API Diagnostik
 * -----------------------------------------------------------------------------
 * Hilft zu analysieren, welche API-Keys für Remote-Bereitschaft und Türsicherheit gesendet werden
 * und ob diese Werte zuverlässig (reliable) aktualisiert werden.
 */

const BASE_PATH       = '0_userdata.0.Energie.Sauna'; 
const axios           = require('axios');             
const REFRESH_MS      = 5 * 1000; // Schnelleres Polling (5s) für die Live-Diagnose während des Tests

const CLIENT_ID       = '24emhb2mm0v4sscqhbdev86b2v';
const FIXED_ID        = '73293847-550d-40da-8bcf-3d6e2fcf5add'; 
const PARTNER_ID      = 'ORG/prod:0:6656:0';                    

const client = axios.create({ timeout: 15000 });     

let idToken        = ''; 
let dataBaseUrl    = ''; 
let authUrl        = ''; 

let lastPayloadString = '';
let previousValues = {};

async function fetchConfig() {
    try {
        const response = await client.get("https://api.harvia.io/endpoints");
        const ep = response.data.endpoints.RestApi;
        dataBaseUrl = ep.data.https;
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

// Rekursive Funktion zum Auffinden aller Keys in einem verschachtelten Objekt
function extractKeysAndValues(obj, prefix = '') {
    let results = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (obj[key] !== null && typeof obj[key] === 'object') {
                Object.assign(results, extractKeysAndValues(obj[key], fullKey));
            } else {
                results[fullKey] = obj[key];
            }
        }
    }
    return results;
}

async function checkStatus() {
    try {
        if (!idToken || !dataBaseUrl) return;

        const response = await client.get(`${dataBaseUrl}/data/latest-data?deviceId=${FIXED_ID}`, {
            headers: { 'Authorization': `Bearer ${idToken}`, 'x-harvia-partner-id': PARTNER_ID }
        });

        const p = response.data?.data;
        if (!p) {
            log('[Harvia-Diag] Keine Daten erhalten', 'warn');
            return;
        }

        const flatData = extractKeysAndValues(p);
        const currentPayloadString = JSON.stringify(flatData);

        if (currentPayloadString !== lastPayloadString) {
            log('[Harvia-Diag] === DATEN-AKTUALISIERUNG ERKANNT ===', 'info');
            
            // Finde heraus, was sich geändert hat
            for (const key in flatData) {
                const newVal = flatData[key];
                const oldVal = previousValues[key];
                if (newVal !== oldVal) {
                    log(`[Harvia-Diag] ÄNDERUNG: [${key}] von [${oldVal}] -> [${newVal}]`, 'info');
                }
            }

            // Relevante Keys filtern und übersichtlich ausgeben
            log('[Harvia-Diag] Relevante Zustände:', 'info');
            const interestingKeywords = ['remote', 'ready', 'door', 'safe', 'heat', 'state', 'light', 'online'];
            for (const key in flatData) {
                if (interestingKeywords.some(keyword => key.toLowerCase().includes(keyword))) {
                    log(`  -> ${key}: ${flatData[key]} (${typeof flatData[key]})`, 'info');
                }
            }

            lastPayloadString = currentPayloadString;
            previousValues = flatData;
        }
    } catch (err) {
        if (err.response && err.response.status === 401) {
            log('[Harvia-Diag] Token abgelaufen, versuche Re-Login...', 'warn');
            await login();
        } else {
            log(`[Harvia-Diag] Abruf-Fehler: ${err.message}`, 'error');
        }
    } finally {
        setTimeout(checkStatus, REFRESH_MS);
    }
}

async function main() {
    log('[Harvia-Diag] Starte Diagnose-Skript...', 'info');
    if (await login()) {
        await checkStatus();
    }
}

main();
