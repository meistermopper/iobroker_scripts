// --- KONFIGURATION ---
const selector = 'linux-control.0.*.nut-client';
const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker").val;

// --- LOGIK ---
on({ id: $(selector), change: 'lt' }, (obj) => {
    // Da Trigger 'lt' ist: Wechsel von true (1) auf false (0)
    const clientName = obj.channelName || obj.deviceNm;
    const msg = `🌰 Der nut-client von ${clientName} ist offline!`;

    // 1. Telegram & Log
    sendTo("telegram", "send", { text: msg });
    console.warn(`NUT-Client Alarm: ${msg}`);

    // 2. Gotify
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker: System" -F "message=${msg}" -F "priority=5"`);
});