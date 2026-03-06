/**
 * Name:   Tankstellen-Logik & Quotenberechnung
 * Zweck:  Setzt Index der günstigsten Station und berechnet prozentuale Häufigkeit
 */

// 1. Zentrale Konfiguration der Tankstellen
const STATIONS = {
    'ac2c10a7-c117-4308-ae6e-6e1f1260f158': { index: 0, suffix: 'oil' },
    '4a58c5a7-c85b-4d20-a36a-ce5f71d1d6e3': { index: 1, suffix: 'bft' },
    '5b797be9-f08f-41a5-9373-70e51c2a2e05': { index: 2, suffix: 'avia' },
    'b8694e60-53a8-40d2-a158-0b1a37b355a5': { index: 3, suffix: 'shell' },
    '00060769-0077-4444-8888-acdc00000077': { index: 4, suffix: 'rwzfrld' },
    '2d444680-d1a3-44b1-afa6-ce48d08b23af': { index: 5, suffix: 'honsel' },
    '00060672-0065-4444-8888-acdc00000065': { index: 6, suffix: 'rwzhr' }
};

const BASE = '0_userdata.0.Tanken.';

// 2. Funktion zur Berechnung der Prozentquoten
function updateProzentQuoten() {
    let summe = 0;
    const stats = {};

    // Werte einlesen und Summe bilden
    Object.values(STATIONS).forEach(s => {
        const wert = getState(`${BASE}Häufigkeit_${s.suffix}`).val || 0;
        stats[s.suffix] = wert;
        summe += wert;
    });

    if (summe > 0) {
        // Prozentwerte für jede Station schreiben
        Object.keys(stats).forEach(suffix => {
            const prozent = (stats[suffix] * 100) / summe;
            setState(`${BASE}Prozent_${suffix}`, prozent, true);
        });
    }
}

// 3. Trigger für Diesel
on({id: 'tankerkoenig.0.stations.cheapest.diesel.station_id', change: 'ne'}, (obj) => {
    const station = STATIONS[obj.state.val];
    if (station) {
        setState(`${BASE}billigste_Tankstelle`, station.index, true);
        updateProzentQuoten(); // Quoten neu berechnen, wenn sich der günstigste Diesel ändert
    }
});

// 4. Trigger für Benzin (E5)
on({id: 'tankerkoenig.0.stations.cheapest.e5.station_id', change: 'ne'}, (obj) => {
    const station = STATIONS[obj.state.val];
    if (station) {
        setState(`${BASE}billigste_Tankstelle_Benzin`, station.index, true);
    }
});