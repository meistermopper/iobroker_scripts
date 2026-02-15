var timeout;

// Optimierte Ausschalt-Funktion
async function screen_aus() {
    if (timeout) { clearTimeout(timeout); timeout = null; }
    timeout = setTimeout(async () => {
        timeout = null;
        // Wir schalten das Display komplett ab statt nur dunkel
        setState('fullybrowser.0.Fully-Browser.Commands.screenOff', true);
    }, 20000);
}

on({ id: 'fullybrowser.0.Fully-Browser.Info.batteryLevel', change: 'ne' }, async (obj) => {
    const batt = obj.state.val;
    const ladeDoseAn = getState('alias.0.wohnzimmer.energie.fully.POWER').val;

    // 1. Laden starten (Unter 30%)
    if (batt < 30 && !ladeDoseAn) {
        setState('alias.0.wohnzimmer.energie.fully.POWER', true);
        await screen_aus();
    } 
    // 2. Laden stoppen (Über 70% ODER genau 100%)
    else if ((batt >= 70 || batt == 100) && ladeDoseAn) {
        setState('alias.0.wohnzimmer.energie.fully.POWER', false);
        await screen_aus();
    } 
    // 3. Alarm-Logik (Akku sinkt trotz Ladewunsch)
    else if (batt < 28 && batt < obj.oldState.val) {
        const message = `Achtung: Wandtablet lädt nicht! Stand: ${batt}%`;
        
        // Telegram immer senden
        sendTo('telegram', 'send', { text: message });
        console.error(message);

        // SayIt nur tagsüber
        if (compareTime('08:00', '20:00', 'between', null)) {
            sendTo("sayit", "say", { text: 'Das Wandtablet lädt nicht. Bitte prüfen.', volume: 40 });
        }
    }
});