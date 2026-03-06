/**
 * Name:   Tankstellen-Häufigkeits-Statistik
 * Zweck:  Zählt alle 10 Min, welche Tankstelle gerade die günstigste ist.
 */

const STATS_CONFIG = {
    'ac2c10a7-c117-4308-ae6e-6e1f1260f158': 'Häufigkeit_oil',
    '4a58c5a7-c85b-4d20-a36a-ce5f71d1d6e3': 'Häufigkeit_bft',
    '5b797be9-f08f-41a5-9373-70e51c2a2e05': 'Häufigkeit_avia',
    'b8694e60-53a8-40d2-a158-0b1a37b355a5': 'Häufigkeit_shell',
    '00060769-0077-4444-8888-acdc00000077': 'Häufigkeit_rwzfrld',
    '2d444680-d1a3-44b1-afa6-ce48d08b23af': 'Häufigkeit_honsel',
    '00060672-0065-4444-8888-acdc00000065': 'Häufigkeit_rwzhr'
};

const BASE_PATH = '0_userdata.0.Tanken.';
const ID_CHEAPEST = 'tankerkoenig.0.stations.cheapest.diesel.station_id';

schedule("*/10 * * * *", () => {
    const cheapestID = getState(ID_CHEAPEST).val;
    const dataPointName = STATS_CONFIG[cheapestID];

    if (dataPointName) {
        const fullPath = BASE_PATH + dataPointName;
        const aktuellerZaehler = getState(fullPath).val || 0;
        
        setState(fullPath, aktuellerZaehler + 1, true);
        
        //console.log(`Statistik: ${dataPointName} war günstigste Tankstelle. Neuer Zähler: ${aktuellerZaehler + 1}`);
    } else {
        console.warn(`Statistik: Unbekannte Tankstellen-ID erkannt: ${cheapestID}`);
    }
});