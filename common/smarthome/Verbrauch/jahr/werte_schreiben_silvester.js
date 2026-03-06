// --- KONFIGURATION DER GERÄTE ---
// Format: 'Anzeigename': 'Sonoff-Datenpunkt-Pfad'
const geraeteListe = {
    'AVR': 'sonoff.0.AVR-Steckdose',
    'Backofen': 'sonoff.0.Backofen',
    'Boiler': 'sonoff.0.Boiler',
    'Drucker': 'sonoff.0.Drucker-Steckdose',
    'Dunstabzug': 'sonoff.0.Dunstabzug',
    'Gefrierschrank': 'sonoff.0.Gefrierschrank',
    'Geschirrspüler': 'sonoff.0.Geschirrspueler',
    'Kaffeeautomat': 'sonoff.0.Kaffeeautomat',
    'Kiki-PC': 'sonoff.0.Kiki-PC-Steckdose',
    'Medienplayer': 'sonoff.0.Medienplayer-Steckdose',
    'R2Maeh2': 'sonoff.0.R2Maeh2-Steckdose',
    'Schlazi-Steckdose': 'sonoff.0.Schlazi-Steckdose',
    'Serverschrank': 'sonoff.0.Serverschrank',
    'TV': 'sonoff.0.TV-Steckdose',
    'Thermomix': 'sonoff.0.Thermomix',
    'Thomas-PC': 'sonoff.0.Thomas-PC-Steckdose',
    'Trockner': 'sonoff.0.Trockner',
    'Waschmaschine': 'sonoff.0.Waschmaschine',
    'Weinklimaschrank': 'sonoff.0.Weinklimaschrank'
};

const zielPfad = '0_userdata.0.Energie.Verbrauch.Jahr';

// --- LOGIK ---

// Jedes Jahr am 31.12. um 23:59:59 Uhr
schedule("59 59 23 31 12 *", async () => {
    let reportListe = [];
    const jahr = new Date().getFullYear();

    for (let name in geraeteListe) {
        const quellPfad = `${geraeteListe[name]}.ENERGY_Total`;
        const wert = Math.round(getState(quellPfad).val);
        const speicherPfad = `${zielPfad}.${name.replace('-', '_')}`; // Ersetzt Bindestriche für DP-Kompatibilität

        // 1. Wert in die Jahresstatistik schreiben
        if (existsState(speicherPfad)) {
            setState(speicherPfad, wert, true);
        }

        // 2. Zeile für Telegram aufbereiten
        reportListe.push(`${name}: ⚡ ${wert} kWh`);
    }

    // Sortieren (Alphabetisch)
    reportListe.sort();

    // 3. Telegram & Log
    const msg = `Die Stromverbrauchswerte ${jahr} wurden geschrieben:\n\n${reportListe.join('\n')}`;
    
    sendTo('telegram', 'send', {
        text: msg,
        user: 'Thomas'
    });
    
    console.log(`Jahresabschluss: ${msg}`);
});