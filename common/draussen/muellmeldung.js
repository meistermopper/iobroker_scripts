// Trigger: Jeden Sonntag bis Freitag um 18:00 Uhr
schedule("0 18 * * 0-5", async () => {
    const daysLeft = getState('trashschedule.0.next.daysLeft').val;
    
    if (daysLeft === 1) {
        const muellSorte = getState('trashschedule.0.next.typesText').val;
        const muellText = `Morgen wird ${muellSorte} abgeholt.`;
        const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker').val;

        // 1. Telegram & Gotify (Funktioniert bereits)
        sendTo('telegram.0', 'send', { text: `🚮 ${muellText}` });
        if (gotifyToken) {
            exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker: Müll" -F "message=🚮 ${muellText}" -F "priority=5"`);
        }

        // 2. Sprachausgabe (Jetzt identisch zum Fenster-Skript)
        //console.log(`Müll-Ansage wird gestartet: ${muellText}`);
        
        // Wir probieren erst deinen Watchdog
        if (typeof googleWatchdogAnnounce === 'function') {
            await googleWatchdogAnnounce(muellText, 40);
        } else {
            // FALLBACK: Jetzt exakt wie im Fenster-Skript ("sayit" ohne .0)
            sendTo("sayit", "say", { text: muellText }); 
            // Optional: Wenn du Volume brauchst, hänge es an: { text: muellText, volume: 40 }
        }
    }
});