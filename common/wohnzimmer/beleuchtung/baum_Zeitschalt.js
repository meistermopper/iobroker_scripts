// --- 1. Goldene Stunde: Baum an ---
schedule({ astro: 'goldenHour', shift: 0 }, async () => {
    // Prüfen ob Online und aktuell noch Aus
    if (getState('sonoff.0.Weihnachtsbaum.alive').val && !getState('sonoff.0.Weihnachtsbaum.POWER').val) {
        
        // Wir schalten den Baum einfach an. 
        // Der 'on'-Trigger unten kümmert sich automatisch um die Galaxie!
        setState('sonoff.0.Weihnachtsbaum.POWER', true);
        
        const msg = '+++🎄 Wohnzimmer: Goldene Stunde, Weihnachtsbaum wurde eingeschaltet +++';
        sendTo('telegram', 'send', { text: msg });
        console.log(msg);
    }
});

// --- 2. Nachtruhe: Baum aus ---
schedule("0 23 * * *", async () => {
    if (getState('sonoff.0.Weihnachtsbaum.alive').val && getState('sonoff.0.Weihnachtsbaum.POWER').val) {
        setState('sonoff.0.Weihnachtsbaum.POWER', false);
        
        const msg = '+++🎄 Weihnachtsbaum wurde ausgeschaltet +++';
        sendTo('telegram', 'send', { text: msg });
        console.log(msg);
    }
});

// --- 3. Die Verriegelung (Watchdog) ---
// Sobald der Baum angeht (egal ob per Schedule, Alexa oder manuell), geht die Galaxie aus.
on({ id: 'sonoff.0.Weihnachtsbaum.POWER', change: 'gt' }, async (obj) => {
    if (getState('sonoff.0.Galaxie.POWER').val) {
        // Wir schalten die Galaxie aus, damit der Baum alleine wirkt
        setState('sonoff.0.Galaxie.POWER', false);
        console.log('Galaxie wurde automatisch ausgeschaltet, da der Weihnachtsbaum Priorität hat.');
    }
});