// --- KONFIGURATION ---
const ID_ACTIVITY_SAT    = 'harmony.0.Harmony_Wozi.activities.SAT_TV';
const ID_ACTIVITY_CHROME = 'harmony.0.Harmony_Wozi.activities.Chromecast_Video';

// --- ZEITPLÄNE ---

// Um Mitternacht: SAT-TV prüfen
schedule("0 0 * * *", async () => {
    if (getState(ID_ACTIVITY_SAT).val === 2) {
        setState(ID_ACTIVITY_SAT, 0);
        sendGlobalNotify('+++📡 SAT activity wurde automatisch ausgeschaltet +++', "ioBroker Safety", 5);
    }
});

// Um 03:01 Uhr: Chromecast prüfen
schedule("1 3 * * *", async () => {
    if (getState(ID_ACTIVITY_CHROME).val > 0) {
        setState(ID_ACTIVITY_CHROME, 0);
        sendGlobalNotify('+++ ⚙️ Chromecast activity wurde automatisch ausgeschaltet +++', "ioBroker Safety", 1);
    }
});
