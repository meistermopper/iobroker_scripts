// Überwacht alle Adapter-Status-Datenpunkte
const selector = 'system.adapter.*.*.alive';

on({id: Buffer.from(selector), change: 'ne'}, async (obj) => {
    // Falls der Adapter auf false geht (ausgestiegen)
    if (obj.state.val === false) {

        // Wir merken uns den Namen/ID lokal für diesen spezifischen Durchlauf
        const adapterId = obj.id; // z.B. system.adapter.admin.0.alive
        const adapterName = obj.channelId; // z.B. system.adapter.admin.0

        // Liste der Adapter, die wir ignorieren (Cron-Jobs etc.)
        const ignoreList = ['daswetter', 'dwd', 'feiertage', 'ical', 'pollenflug', 'proxmox'];

        // Prüfen, ob der Adapter ignoriert werden soll
        const nameOnly = obj.channelName; // Name ohne Instanznummer
        if (ignoreList.includes(nameOnly)) return;

        console.log(`⚠️ Adapter ${adapterName} hat sich abgemeldet. Warte 3 Minuten auf Reconnect`);

        // 3 Minuten warten, bevor Alarm geschlagen wird
        setTimeout(async () => {
            // Aktuellen Status erneut prüfen
            const currentStatus = getState(adapterId);

            if (currentStatus && currentStatus.val === false) {
                const msg = `**+++ ⚠️ Der ${adapterName} ist ausgestiegen! +++**`;

                // 1. Log-Eintrag
                console.warn(msg);

                // 2. Telegram
                sendTo('telegram', 'send', { text: msg });

                // 3. Gotify via httpPost (Token wird aus 0_userdata geholt)
                const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker')?.val;
                if (gotifyToken) {
                    httpPost(`https://mygotify.meistermopper.de/message?token=${gotifyToken}`, {
                        title: "ioBroker:",
                        message: msg,
                        priority: 1
                    }, (error) => {
                        if (error) console.error(`[Adapter Off] Gotify Fehler: ${error}`);
                    });
                }
            } else {
                console.log(`✅ Entwarnung: ${adapterName} hat sich wieder gefangen`);
            }
        }, 180000); // 3 Minuten Verzögerung
    }
});
