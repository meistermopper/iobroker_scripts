// --- PROGRAMM-MAPPING ---
const PROGRAMME = {
    200: 'eco', 201: 'auto', 203: 'ComfortWash', 204: 'PowerWash',
    205: 'Intensiv75', 206: 'Hygiene75', 207: 'extra leise50',
    208: 'SolarSpar', 209: 'ComfortWash55', 210: 'Fein45',
    211: 'o. Oberkorb', 212: 'Pasta/Paella', 213: 'Gläser',
    214: 'Gerätepflege', 215: 'Salz spülen', 0: 'aus'
};

let Strompreis_proKWh = getState('0_userdata.0.Energie.Strompreise.akt_Preis')?.val;
let start, EnergieStart;

// Preis-Update
on({ id: '0_userdata.0.Energie.Strompreise.akt_Preis', change: 'ne' }, obj => {
    Strompreis_proKWh = obj.state.val;
});

// Programm-Dekodierung (Dynamisch)
on({ id: 'alias.0.kueche.geschirr.Programmbezeichnung_raw', change: 'any' }, obj => {
    const name = PROGRAMME[obj.state.val] || `Unbekannt (${obj.state.val})`;
    setState('alias.0.kueche.geschirr.Programmbezeichnung', name, true);
});

// Hauptlogik Spülen
on({ id: 'mielecloudservice.0.000106831213.Status', change: 'ne' }, async (obj) => {
    const status = obj.state.val;
    const isSpuelenAktiv = getState('0_userdata.0.Haushalt.spuelen')?.val;
    const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker')?.val;

    // --- START ---
    if (!isSpuelenAktiv && status === 'In Betrieb') {
        start = Date.now();
        // Wir merken uns den Zählerstand beim Start
        EnergieStart = getState('alias.0.kueche.geschirr.ENERGY_Total')?.val;
        setState('0_userdata.0.Haushalt.spuelen', true, true);

        setTimeout(() => {
            const endTime = getState('mielecloudservice.0.000106831213.estimatedEndTime')?.val;
            const vorhersage = `Der Geschirrspüler spült und ist voraussichtlich um ${endTime} Uhr fertig.`;
            
            if (compareTime('08:00', '20:00', 'between')) sendTo("sayit", "say", { text: vorhersage });
            sendTo('telegram', 'send', { text: vorhersage, parse_mode: 'HTML' });
            exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker" -F "message=${vorhersage}" -F "priority=1"`);
        }, 10000);
    } 

    // --- ENDE ---
    else if (status === 'Ende' && isSpuelenAktiv) {
        const spueldauerMin = Math.round((Date.now() - start) / 60000);
        
        // Berechnung des Verbrauchs für DIESEN Durchgang
        const energieKwh = getState('alias.0.kueche.geschirr.ENERGY_Total')?.val - EnergieStart;
        const euro = (energieKwh * Strompreis_proKWh).toFixed(2);
        
        const dauerStd = Math.floor(spueldauerMin / 60);
        const dauerMin = (spueldauerMin % 60).toString().padStart(2, '0');
        
        const wasser = getState('mielecloudservice.0.000106831213.EcoFeedback.currentWaterConsumption')?.val;
        
        // Fix für "Heute": Wir nutzen den ENERGY_Today Punkt vom Gerät, 
        // falls dieser wieder spinnt, müssten wir einen eigenen Zähler in userdata anlegen.
        const energieHeute = getState('alias.0.kueche.geschirr.ENERGY_Today')?.val;
        const euroHeute = (energieHeute * Strompreis_proKWh).toFixed(2);

        const programm = getState('alias.0.kueche.geschirr.Programmbezeichnung')?.val;
        setState('0_userdata.0.Haushalt.spuelen', false, true);
        
        const meldetext = `<pre>💦 Der Geschirrspüler kann ausgeräumt werden.\n\n` +
                          `Programm: ${programm}\n` +
                          `Dauer: ${dauerStd}:${dauerMin} Std.\n` +
                          `Verbrauch: ${energieKwh.toFixed(2)} kWh (${euro} €)\n` +
                          `Heute gesamt: ${energieHeute.toFixed(2)} kWh (${euroHeute} €) & ${wasser}L Wasser\n` +
                          `Preis/kWh: ${Strompreis_proKWh.toFixed(3)} €</pre>`;

        if (compareTime('08:00', '20:00', 'between')) sendTo("sayit", "say", { text: 'Der Geschirrspüler kann ausgeräumt werden.' });
        sendTo('telegram', 'send', { text: meldetext, parse_mode: 'HTML' });
        
        // Gotify Nachricht ohne HTML-Tags für bessere Lesbarkeit
        const gotifyMsg = meldetext.replace(/<[^>]*>/g, '');
        exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker" -F "message=${gotifyMsg}" -F "priority=1"`);
    }
});