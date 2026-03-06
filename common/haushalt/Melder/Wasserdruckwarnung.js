/**
 * Name:   Heizung Wasserdruck Überwachung v1.2
 * Zweck:  Warnt, wenn der Druck unter die Schwelle fällt.
 */

// --- KONFIGURATION ---
const ID_DRUCK = 'vaillant.0.44c040a5-2e4f-4933-b508-22584e0854c2.state.system.systemWaterPressure';
const ID_STATUS_DP = '0_userdata.0.Heizen.Status.Wasserdruck';
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';
const SCHWELLE = 1.7; // Konsistent mit Kommentar

// --- LOGIK ---
on({ id: ID_DRUCK, change: 'ne' }, (obj) => {
    const druck = obj.state.val;
    const alterDruck = obj.oldState ? obj.oldState.val : 0;

    // Nur auslösen, wenn der Druck NEU unter die Schwelle fällt
    if (druck < SCHWELLE && alterDruck >= SCHWELLE) {
        
        const msg = `⚠️ Wasserdruck zu niedrig! Aktuell: ${druck.toFixed(1)} Bar. Bitte Wasser auffüllen.`;

        // 1. Telegram
        sendTo('telegram', 'send', { text: msg });

        // 2. Logausgabe
        console.warn(`[Heizung] Alarm: ${msg}`);

        // 3. Gotify (Optimiert mit Timeout & JSON)
        const token = getState(ID_GOTIFY_TOKEN).val;
        if (token) {
            const url = `https://mygotify.meistermopper.de/message?token=${token}`;
            httpPost(url, {
                title: "ioBroker: Heizung",
                message: msg,
                priority: 8
            }, { timeout: 5000 }, (err) => {
                if (err) console.error(`[Heizung] Gotify Fehler: ${err.message}`);
            });
        }

        // 4. Status-Datenpunkt setzen
        setState(ID_STATUS_DP, true, true);

        // 5. Sprachausgabe (Nur tagsüber 08:00 - 20:00)
        if (compareTime('08:00', '20:00', 'between')) {
            sendTo("sayit", "say", { 
                text: `Der Wasserdruck der Heizung ist mit ${druck.toFixed(1)} Bar zu niedrig.`, 
                volume: 50 
            });
        }

    } 
    // Wenn der Druck wieder okay ist (Normalzustand)
    else if (druck >= SCHWELLE && alterDruck < SCHWELLE) {
        setState(ID_STATUS_DP, false, true);
        console.log(`[Heizung] Wasserdruck wieder OK: ${druck.toFixed(1)} Bar.`);
    }
});