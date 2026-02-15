const url = 'http://www.solarprognose.de/web/solarprediction/api/v1?_format=json&access-token=72206e8f60f98f2a22101ea20fd0c999&item=inverter&id=4511&type=hourly';
const path = '0_userdata.0.Energie.PV.Prognose.';

// Nur einmalig beim Skriptstart prüfen, ob DPs da sind (verhindert unnötige Last)
function initDPs() {
    createState(path + 'Json', "", {name: 'Gesamt JSON', type: 'string', role: 'json'});
    createState(path + 'heute.Json', [], {name: 'json heute', type: 'array', role: 'json'});
    createState(path + 'morgen.Json', [], {name: 'json morgen', type: 'array', role: 'json'});
    createState(path + 'uebermorgen.Json', [], {name: 'json uebermorgen', type: 'array', role: 'json'});
}
initDPs();

schedule('4 8,10,12,14,16,18,20 * * *', function() {
      abfrage();
});

function abfrage() {
    // Wir nutzen ein höheres Timeout (10 Sek) für träge Server
    httpGet(url, { timeout: 10000 }, function (error, response) {
        if (error) {
            log('Solarprognose Serverfehler (Timeout?): ' + error, 'warn');
            return;
        }
        
        try {
            let obj = JSON.parse(response.data);
            if (!obj || !obj.data) {
                log('Solarprognose: JSON empfangen, aber keine Daten enthalten', 'warn');
                return;
            }

            setState(path + 'Json', JSON.stringify(obj.data), true);
            dpFill(obj);
        } catch (e) {
            log('Solarprognose: Fehler beim Parsen der Antwort: ' + e, 'error');
        }
    });
}

function dpFill(obj) {
    if (obj.status && obj.status !== 0) { 
        log('Solarprognose API meldet Statusfehler: ' + obj.status, 'warn');
    } else {
        const outArray = formatAndSplitData(obj.data);
        setState(path + 'heute.Json', outArray.heute, true);   
        setState(path + 'morgen.Json', outArray.morgen, true); 
        setState(path + 'uebermorgen.Json', outArray.uebermorgen, true); 
    }
}

// Deine Logik für das Splitten bleibt gleich
function formatAndSplitData(data) {
    const SECONDS_IN_A_DAY = 86400;
    const MS_IN_A_SECOND = 1000;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + SECONDS_IN_A_DAY * MS_IN_A_SECOND;
    const dayAfterTomorrowStart = tomorrowStart + SECONDS_IN_A_DAY * MS_IN_A_SECOND;
    const result = { heute: [], morgen: [], uebermorgen: [] };

    for (const [timestamp, values] of Object.entries(data)) {
        const ts = Number(timestamp) * MS_IN_A_SECOND;
        const date = new Date(ts);
        const formattedTime = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const entry = [formattedTime, ...values];
 
        if (ts >= todayStart && ts < tomorrowStart) {
            result.heute.push(entry);
        } else if (ts >= tomorrowStart && ts < dayAfterTomorrowStart) {
            result.morgen.push(entry);
        } else if (ts >= dayAfterTomorrowStart) {
            result.uebermorgen.push(entry);
        }
    }
    return result;
}