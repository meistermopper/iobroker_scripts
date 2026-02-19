/**
 * Name:   Tasmota Firmware Checker & Notifier
 * Zweck:  Prüft auf GitHub und meldet neue Versionen inkl. Geräteliste
 */

const logging = true;
const id_Version_Internet = '0_userdata.0.Servicemeldungen.Verfuegbare_Tasmota-Firmware';

async function checkTasmotaVersion() {
    try {
        httpGet('https://api.github.com/repos/arendst/Tasmota/releases/latest', { 
            headers: { 'User-Agent': 'ioBroker' } 
        }, async (err, response) => {
            
            if (err || !response) return;

            const data = JSON.parse(response.data);
            const latestFullVersion = data.tag_name.replace(/v/i, "").trim() + '(release-tasmota)';
            const lastKnownVersion = (await getStateAsync(id_Version_Internet)).val;

            let updateDevices = [];
            const tasmotaStates = $('channel[state.id=sonoff.0.*.Info1_Version]');
            
            tasmotaStates.each(id => {
                const installedRaw = getState(id).val || "";
                const installed = installedRaw.replace(/\((sonoff|tasmota)\)/gi, '').trim();
                const deviceRoot = id.substring(0, id.lastIndexOf("."));
                const hostName = getState(deviceRoot + '.Info2_Hostname').val || "Unbekannt";

                if (installed !== latestFullVersion.replace('(release-tasmota)', '').trim()) {
                    updateDevices.push(`${hostName} (ist: ${installed})`);
                }
            });

            // Logik: Nur melden, wenn neue Version im Netz UND Geräte nicht aktuell
            if (latestFullVersion !== lastKnownVersion && updateDevices.length > 0) {
                
                const message = `🆕 Tasmota Firmware vorhanden!\nVersion: ${latestFullVersion}\n\nBetroffene Geräte:\n${updateDevices.join('\n')}`;
                
                // Internet-Stand aktualisieren
                await setStateAsync(id_Version_Internet, latestFullVersion, true);

                // Telegram
                sendTo('telegram', 'send', { text: message });

                // Gotify
                const token = (await getStateAsync('0_userdata.0.gotifytoken.iobroker')).val;
                if (token) {
                    exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=Tasmota Update" -F "message=${message}" -F "priority=1"`);
                }

                if (logging) console.warn(`Tasmota: ${message}`);
            }
        });
    } catch (e) {
        log(`Fehler im Tasmota-Skript: ${e}`, 'error');
    }
}

// Zeitplan & Start
schedule("11 10 * * *", checkTasmotaVersion);
checkTasmotaVersion();