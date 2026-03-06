// =============================================================================
// ZIGBEE-HOST VERSION-CHECKER v2.1 (FIX: SSH AUTH)
// =============================================================================

const ID_REMOTE_IP = '192.168.178.80';
const BASE_PATH    = '0_userdata.0.ioBroker.RPI_Zigbee.';

async function updateZigbeeVersions() {
    // -o StrictHostKeyChecking=no : Akzeptiert den Key automatisch
    // -o UserKnownHostsFile=/dev/null : Speichert ihn nicht permanent (sauberer für Skripte)
    const sshFlags = '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
    const remoteCmd = '"iobroker -v; node -v; nodejs -v; npm -v"';
    
    const command = `ssh ${sshFlags} thomas@${ID_REMOTE_IP} ${remoteCmd}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Version-Check] SSH-Fehler bei ${ID_REMOTE_IP}: ${error.message}`);
            return;
        }

        const lines = stdout.trim().split('\n');

        if (lines.length >= 4) {
            setState(BASE_PATH + 'js_contr_ver', lines[0].trim(), true);
            setState(BASE_PATH + 'node_ver',     lines[1].trim(), true);
            setState(BASE_PATH + 'nodejs_ver',   lines[2].trim(), true);
            setState(BASE_PATH + 'npm_ver',      lines[3].trim(), true);
            
            //console.log(`[Version-Check] Alle Versionen von ${ID_REMOTE_IP} erfolgreich aktualisiert.`);
        } else {
            console.warn(`[Version-Check] Unerwarteter Output (zu kurz). Checke SSH-Key/User.`);
        }
    });
}

schedule("5 * * * *", updateZigbeeVersions);
updateZigbeeVersions();