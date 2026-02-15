// --- KONFIGURATION ---
const ID_HUMIDITY = 'alias.0.bad_oben.klima.humidity';
const ID_TEMP_AKTUELL = 'alias.0.bad_oben.klima.temperature';
const ID_SETPOINT = 'alias.0.bad_oben.heizung.SET_POINT_TEMPERATURE';
const ID_HEIZUNG_STATE = 'alias.0.bad_oben.fenster.STATE';
const ID_VAILLANT_MODE = 'vaillant.0.44c040a5-2e4f-4933-b508-22584e0854c2.configuration.zones01.heating.operationModeHeating';
const ID_FEUCHTE_HOCH = '0_userdata.0.Heizen.Feuchte.Bad_oben.Feuchte_hoch';
const ID_GOTIFY_TOKEN = '0_userdata.0.gotifytoken.iobroker';

// IDs für Programme
const ID_PROG_GAST = '0_userdata.0.Heizen.Programme.Gast_oben';
const ID_PROG_TAGUNG = '0_userdata.0.Heizen.Programme.Tagung';

let alteTemperatur = getState(ID_SETPOINT).val;
let entfeuchten = false;

// --- HILFSFUNKTIONEN ---

function sendeMeldung(msg) {
    // Telegram
    sendTo('telegram', 'send', { text: msg });
    
    // Gotify
    const token = getState(ID_GOTIFY_TOKEN).val;
    const url = `https://mygotify.meistermopper.de/message?token=${token}`;
    exec(`curl "${url}" -F "title=ioBroker" -F "message=${msg}" -F "priority=1"`);
    
    //console.log(msg); // Im Log als Info, statt Warn
}

// --- LOGIK ---

// 1. Überwachung der Luftfeuchtigkeit
on({ id: ID_HUMIDITY, change: 'ne' }, (obj) => {
    const luftfeuchte = obj.state.val;
    const heizungIstAus = getState(ID_HEIZUNG_STATE).val === 0;
    const aktuelleTemp = getState(ID_TEMP_AKTUELL).val;
    const vaillantNichtOff = getState(ID_VAILLANT_MODE).val !== 'OFF';

    // START: Luftfeuchtigkeit >= 60%
    if (luftfeuchte >= 60 && heizungIstAus && aktuelleTemp < 24 && vaillantNichtOff && !entfeuchten) {
        alteTemperatur = getState(ID_SETPOINT).val;
        entfeuchten = true;
        
        setState(ID_SETPOINT, 24);
        setState(ID_FEUCHTE_HOCH, true, true);
        
        const msg = `♨️ Die Entfeuchtung im Bad oben wurde gestartet (${luftfeuchte}% rL).\n` +
                    `Die Temperatur wurde auf 24°C eingestellt.\n` +
                    `Vorherige Zieltemperatur: ${alteTemperatur}°C.`;
        sendeMeldung(msg);
    } 
    
    // STOPP: Luftfeuchtigkeit <= 57% (und sinkend)
    else if (luftfeuchte <= 57 && obj.oldState.val > luftfeuchte && heizungIstAus && entfeuchten) {
        entfeuchten = false;
        
        // Prüfen, ob ein Programm aktiv ist (05:00 - 22:00 Uhr)
        const programmAktiv = getState(ID_PROG_GAST).val || getState(ID_PROG_TAGUNG).val;
        
        if (compareTime('05:00', '22:00', 'between') && programmAktiv) {
            setState(ID_SETPOINT, 21);
            setState(ID_FEUCHTE_HOCH, false, true);
        } else {
            setState(ID_SETPOINT, alteTemperatur);
            setState(ID_FEUCHTE_HOCH, false, true);
            
            const msg = `+++ ✅ Die Entfeuchtung im Bad oben wurde beendet +++\n` +
                        `(${luftfeuchte}% rL). Heizung wieder auf ${alteTemperatur}°C. ✔️`;
            sendeMeldung(msg);
        }
    }
});

// 2. Schutzschaltung: Verhindert manuelle Änderung während Entfeuchtung
on({ id: ID_SETPOINT, change: 'ne' }, (obj) => {
    if (entfeuchten && getState(ID_HEIZUNG_STATE).val === 0 && obj.state.val !== 24) {
        setState(ID_SETPOINT, 24);
    }
});