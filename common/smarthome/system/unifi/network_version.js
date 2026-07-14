/* eslint-env es2022 */
// =============================================================================
// UNIFI-NETWORK-VERSION v1.1 (FIX: TIMEOUT & ERROR HANDLING)
// =============================================================================

const axios = require("axios");
const https = require("node:https");

// --- KONFIGURATION ---
const udmIp = "192.168.1.1";
const user = getState("0_userdata.0.Unifi.user")?.val;
const pass = getState("0_userdata.0.Unifi.password")?.val;

const DP_PATH = "0_userdata.0.Unifi.";
const dpNetworkVersion = `${DP_PATH}network_version`;
const dpNetworkUpdate = `${DP_PATH}network_update_available`;

const agent = new https.Agent({ rejectUnauthorized: false });

async function getUnifiData() {
  try {
    // 1. Login mit erhöhtem Timeout (15s)
    const loginRes = await axios.post(
      `https://${udmIp}/api/auth/login`,
      {
        username: user,
        password: pass,
      },
      {
        httpsAgent: agent,
        timeout: 15000,
      },
    );

    if (!loginRes.headers["set-cookie"]) {
      throw new Error("Kein Login-Cookie erhalten.");
    }

    const headers = { Cookie: loginRes.headers["set-cookie"].join("; ") };

    // 2. Network Version & Update-Status abrufen
    const sysRes = await axios.get(`https://${udmIp}/proxy/network/api/s/default/stat/sysinfo`, {
      headers: headers,
      httpsAgent: agent,
      timeout: 15000,
    });

    if (sysRes.data?.data?.[0]) {
      const sys = sysRes.data.data[0];
      const version = sys.version || "---";
      const updateAvailable = !!sys.updatable;

      setState(dpNetworkVersion, version, true);
      setState(dpNetworkUpdate, updateAvailable, true);

      //console.log(`[Unifi] Check erfolgreich: v${version} (Update: ${updateAvailable})`);
    } else {
      console.warn("[Unifi] API lieferte keine gültigen Daten für sysinfo");
    }

    // 3. UDM Pro Gerätestatus (inkl. Firmware-Update) abrufen
    const devRes = await axios.get(`https://${udmIp}/proxy/network/api/s/default/stat/device`, {
      headers: headers,
      httpsAgent: agent,
      timeout: 15000,
    });

    if (devRes.data?.data) {
      const udmMac = "78:45:58:c7:61:75";
      const udm = devRes.data.data.find((d) => d.mac === udmMac);
      if (udm) {
        const udmUpgradable = !!udm.upgradable;
        const dpUdmUpgradable = `${DP_PATH}udm_pro_upgradable`;

        if (!existsState(dpUdmUpgradable)) {
          createState(
            dpUdmUpgradable,
            false,
            {
              name: "UDM Pro Update verfügbar",
              type: "boolean",
              role: "indicator.update",
              read: true,
              write: false,
            },
            () => {
              setState(dpUdmUpgradable, udmUpgradable, true);
            },
          );
        } else {
          setState(dpUdmUpgradable, udmUpgradable, true);
        }
      } else {
        console.warn(`[Unifi] UDM Pro mit MAC ${udmMac} nicht in Geräteliste gefunden`);
      }
    } else {
      console.warn("[Unifi] API lieferte keine gültigen Daten für Gerätestatus");
    }
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      console.error(
        `[Unifi] Timeout erreicht: Die UDM unter ${udmIp} hat nicht schnell genug geantwortet`,
      );
    } else {
      console.error(`[Unifi] Fehler im Skript: ${err.message}`);
    }
  }
}

// Start beim Skriptstart
getUnifiData();

// Zeitplan: Alle 12 Stunden
schedule("7 */12 * * *", getUnifiData);
