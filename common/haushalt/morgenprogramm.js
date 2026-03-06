/*******************************************************
 * Finales Morgenprogramm - 20 Min Lichtwecker & Schutz
 *******************************************************/

let timerMorgen = []; 
let programmLaeuft = false; 

function stopAllTimers() {
    timerMorgen.forEach(t => clearTimeout(t));
    timerMorgen = [];
    if (typeof dimmInterval !== 'undefined') {
        clearInterval(dimmInterval);
        dimmInterval = null;
    }
    programmLaeuft = false;
}

async function Morgenprogramm(typ) {
    if (programmLaeuft) {
        log("Morgenprogramm: Start ignoriert, bereits aktiv (" + typ + ")", "warn");
        return;
    }

    stopAllTimers(); 
    programmLaeuft = true;
    log("Morgenprogramm gestartet für: " + typ);

    // Initialisierung Geräte
    setState('chromecast.0.f0ef862c5b50.player.volume', 20);
    setState('chromecast.0.f0ef862c5b50.player.url2play', 'https://dispatcher.rndfnk.com/hr/hr1/live/mp3/high');
    setState('alias.0.schlafzimmer.energie.schrank.state', true);
    setState('alias.0.schlafzimmer.energie.bett.state', true);

    // Lichtwecker starten (Dauer: 20 Min)
    hochdimmen();

    // Radio-Logik (Ablaufsteuerung)
    timerMorgen.push(setTimeout(() => {
        setState('chromecast.0.f0ef862c5b50.player.stop', true);
        setState('0_userdata.0.heos.Bad.sender', 'hr1');
        
        timerMorgen.push(setTimeout(() => {
            setState('chromecast.0.f0ef862c5b50.player.volume', 20);
            setState('chromecast.0.f0ef862c5b50.player.url2play', 'https://dispatcher.rndfnk.com/hr/hr1/live/mp3/high');
            timerMorgen.push(setTimeout(() => setState('chromecast.0.f0ef862c5b50.player.stop', true), 180000));
        }, 1020000));
    }, 180000));

    // Nach 25 Min: Licht aus & Reset (Sperre wird aufgehoben)
    timerMorgen.push(setTimeout(() => {
        setState('hue.0.Nachttisch.on', false);
        setState('alias.0.schlafzimmer.energie.schrank.state', false);
        setState('alias.0.schlafzimmer.energie.bett.state', false);
        programmLaeuft = false; 
    }, 1500000));

    // Küchenradio
    timerMorgen.push(setTimeout(() => {
        setState('chromecast.0.d86c63581a19.player.volume', 20);
        setState('chromecast.0.d86c63581a19.player.url2play', 'https://dispatcher.rndfnk.com/hr/hr1/live/mp3/high');
        timerMorgen.push(setTimeout(() => setState('chromecast.0.d86c63581a19.player.stop', true), 2100000));
    }, 1800000));
}

let dimmInterval;
function hochdimmen() {
    let level = 1;
    // Sofort-Start: Kaltweiß für den Wachmacher-Effekt
    setState('hue.0.Nachttisch.ct', 5500);
    setState('hue.0.Nachttisch.level', level);

    dimmInterval = setInterval(() => {
        if (level < 100) {
            level++;
            setState('hue.0.Nachttisch.level', level);
        } else {
            clearInterval(dimmInterval);
            dimmInterval = null;
            // Nach 3 Min (Sonne ist aufgegangen) auf Warmweiß wechseln
            timerMorgen.push(setTimeout(() => {
                setState('hue.0.Nachttisch.ct', 2700);
                setStateDelayed('hue.0.Nachttisch.level', 50, 500);
            }, 180000));
        }
    }, 12000); // 12 Sekunden * 100 Schritte = 20 Minuten
}

// Zeitpläne
schedule("0 5 * * 1-5", () => {
    if (getState('0_userdata.0.Heizen.Programme.standard').val && !getState('feiertage.0.heute.boolean').val) {
        Morgenprogramm("Standard");
    }
});

schedule("30 5 * * 1-5", () => {
    if (getState('0_userdata.0.Heizen.Programme.Homeoffice').val && !getState('feiertage.0.heute.boolean').val) {
        Morgenprogramm("Homeoffice");
    }
});