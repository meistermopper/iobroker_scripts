// --- KONFIGURATION ---
const IGNORE_LIST = ['Testgeraet_1', 'Alte_Lampe']; // Namen von Geräten, die nicht nerven sollen

on({ id: /^zigbee\.0\..*\.available$/, change: 'ne' }, async (obj) => {
    const status = !!obj.state.val;
    const deviceName = obj.channelName || 'Unbekanntes Gerät';

    // Falls das Gerät auf der Ignorier-Liste steht, abbrechen
    if (IGNORE_LIST.includes(deviceName)) return;

    // Nur bei "Offline" sofort melden, bei "Online" nur im Log vermerken
    if (!status) {
        const msg = `⚠️ Zigbee-Gerät offline: ${deviceName}`;
        sendTo('telegram', 'send', { text: msg });
        console.warn(msg);
    } else {
        // Optional: Meldung, wenn es wieder da ist (nur Log)
        console.log(`🛎️ Zigbee-Gerät wieder erreichbar: ${deviceName}`);
    }
});