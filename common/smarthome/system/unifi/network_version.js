// =============================================================================
// UNIFI-NETWORK-VERSION v1.1 (FIX: TIMEOUT & ERROR HANDLING)
// =============================================================================

const axios = require('axios');
const https = require('https');

// --- KONFIGURATION ---
const udmIp = '192.168.1.1';
const user  = 'meistermopper'; 
const pass  = 'DBtRkL###123'; 

const DP_PATH = '0_userdata.0.Unifi.';
const dpNetworkVersion = DP_PATH + 'network_version';
const dpNetworkUpdate  = DP_PATH + 'network_update_available';

const agent = new https.Agent({ rejectUnauthorized: false });

async function getUnifiData() {
    try {
        // 1. Login mit erhöhtem Timeout (15s)
        const loginRes = await axios.post(`https://${udmIp}/api/auth/login`, {
            username: user, 
            password: pass
        }, { 
            httpsAgent: agent, 
            timeout: 15000 
        });

        if (!loginRes.headers['set-cookie']) {
            throw new Error("Kein Login-Cookie erhalten.");
        }

        const headers = { 'Cookie': loginRes.headers['set-cookie'].join('; ') };

        // 2. Network Version & Update-Status abrufen
        const sysRes = await axios.get(`https://${udmIp}/proxy/network/api/s/default/stat/sysinfo`, {
            headers: headers, 
            httpsAgent: agent,
            timeout: 15000
        });

        if (sysRes.data && sysRes.data.data && sysRes.data.data[0]) {
            const sys = sysRes.data.data[0];
            const version = sys.version || "---";
            const updateAvailable = !!sys.updatable;

            setState(dpNetworkVersion, version, true);
            setState(dpNetworkUpdate, updateAvailable, true);
            
            //console.log(`[Unifi] Check erfolgreich: v${version} (Update: ${updateAvailable})`);
        } else {
            console.warn("[Unifi] API lieferte keine gültigen Daten für sysinfo.");
        }

    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            console.error(`[Unifi] Timeout erreicht: Die UDM unter ${udmIp} hat nicht schnell genug geantwortet.`);
        } else {
            console.error("[Unifi] Fehler im Skript: " + err.message);
        }
    }
}

// Start beim Skriptstart
getUnifiData();

// Zeitplan: Alle 12 Stunden
schedule("7 */12 * * *", getUnifiData);