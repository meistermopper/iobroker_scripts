// --- Konfiguration IDs ---
const ID_HUMIDITY      = 'alias.0.bad_unten.heizung.HUMIDITY';
const ID_SET_TEMP      = 'alias.0.bad_unten.heizung.SET_POINT_TEMPERATURE';
const ID_ACTUAL_TEMP   = 'alias.0.bad_unten.heizung.ACTUAL_TEMPERATURE';
const ID_WINDOW_STATE  = 'alias.0.bad_unten.heizung.WINDOW_STATE'; // 0 = zu
const ID_HEATING_MODE  = 'vaillant.0.44c040a5-2e4f-4933-b508-22584e0854c2.configuration.zones01.heating.operationModeHeating';
const ID_ENTFEUCHTEN_VOTUM = '0_userdata.0.Heizen.Feuchte.Bad_unten.entfeuchten';
const ID_GOTIFY_TOKEN  = '0_userdata.0.gotifytoken.iobroker';

let vorigesTemperaturLevel = getState(ID_SET_TEMP).val;
let istAmEntfeuchten = false;

// Hilfsfunktion für Meldungen
function sendeMeldung(msg) {
    //console.warn(`[Bad Entfeuchtung] ${msg}`);
    sendTo('telegram', 'send', { text: msg });
    
    const token = getState(ID_GOTIFY_TOKEN).val;
    const url = `https://mygotify.meistermopper.de/message?token=${token}`;
    exec(`curl "${url}" -F "title=ioBroker" -F "message=${msg}" -F "priority=1"`);
}

// Hauptlogik: Feuchtigkeit Trigger
on({ id: ID_HUMIDITY, change: 'ne' }, async (obj) => {
    const luftfeuchte = obj.state.val;
    const fensterZu = getState(ID_WINDOW_STATE).val === 0;
    const istTempNiedrig = getState(ID_ACTUAL_TEMP).val < 24;
    const heizungAn = getState(ID_HEATING_MODE).val !== 'OFF';
    
    // START: Entfeuchten (Feuchte > 60% + Fenster zu + Heizung bereit + nicht bereits aktiv)
    if (luftfeuchte >= 60 && fensterZu && istTempNiedrig && heizungAn && !istAmEntfeuchten) {
        vorigesTemperaturLevel = getState(ID_SET_TEMP).val;
        istAmEntfeuchten = true;
        
        setState(ID_SET_TEMP, 24);
        setState(ID_ENTFEUCHTEN_VOTUM, true, true);
        
        sendeMeldung(`♨️ Entfeuchtung im Bad unten gestartet (${luftfeuchte}% rL).\nTemperatur auf 24°C gesetzt (vorher ${vorigesTemperaturLevel}°C).`);
    } 
    
    // STOPP: Entfeuchten (Feuchte < 57% oder Fenster auf)
    else if (luftfeuchte <= 57 && fensterZu && istAmEntfeuchten) {
        istAmEntfeuchten = false;
        setState(ID_ENTFEUCHTEN_VOTUM, false, true);

        // Zieltemperatur bestimmen
        let neueTemp = vorigesTemperaturLevel;
        const istTag = compareTime('05:00', '22:00', 'between');
        const programmZuhause = getState('0_userdata.0.Heizen.Programme.Zuhause').val;

        if (istTag && programmZuhause) {
            neueTemp = 21;
        }

        setState(ID_SET_TEMP, neueTemp);
        sendeMeldung(`✅ Entfeuchtung im Bad unten beendet (${luftfeuchte}% rL).\nHeizung wieder auf ${neueTemp}°C eingestellt.`);
    }
});

// Schutz vor manueller Änderung während Entfeuchtung
on({ id: ID_SET_TEMP, change: 'ne', ack: false }, (obj) => {
    if (istAmEntfeuchten && getState(ID_WINDOW_STATE).val === 0) {
        if (obj.state.val !== 24) {
            setState(ID_SET_TEMP, 24); // Zurück auf 24 erzwingen
            //console.log("Manuelle Änderung während Entfeuchtung blockiert.");
        }
    }
});