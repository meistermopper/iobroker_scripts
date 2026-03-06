// Konfiguration: Quell-Datenpunkt -> Ziel-Alias Pfad
const devices = [
    // --- BEREICH: LICHT (Nutzt den vorhandenen Ordner) ---
    { source: 'sonoff.0.Quader.POWER', alias: 'licht.quader.on', role: 'switch.light' },
    { source: 'sonoff.0.Spirale.POWER', alias: 'licht.spirale.on', role: 'switch.light' },
    { source: 'sonoff.0.Weihnachtsbaum.POWER', alias: 'licht.weihnachtsbaum.on', role: 'switch.light' },
    { source: 'sonoff.0.Wozilampe.POWER', alias: 'licht.wozilampe.on', role: 'switch.light' },

    // --- BEREICH: ENERGIE (Wird neu angelegt) ---
    { source: 'sonoff.0.AVR-Steckdose.POWER', alias: 'energie.avr.on', role: 'switch' },
    { source: 'sonoff.0.AVR-Steckdose.ENERGY_Power', alias: 'energie.avr.power', role: 'value.power', unit: 'W' },
    { source: 'sonoff.0.TV-Steckdose.POWER', alias: 'energie.tv.on', role: 'switch' },
    { source: 'sonoff.0.TV-Steckdose.ENERGY_Power', alias: 'energie.tv.power', role: 'value.power', unit: 'W' },
    { source: 'sonoff.0.Smartlader.POWER', alias: 'energie.smartlader.on', role: 'switch' }
];

async function setupAliases() {
    for (const dev of devices) {
        const fullAliasPath = `alias.0.wohnzimmer.${dev.alias}`;
        
        await setObjectAsync(fullAliasPath, {
            type: 'state',
            common: {
                name: dev.alias.split('.').pop(), 
                role: dev.role,
                type: 'mixed',
                read: true,
                write: true,
                unit: dev.unit || '',
                alias: { id: dev.source }
            },
            native: {}
        });
        console.log(`✔ Alias konfiguriert: ${fullAliasPath}`);
    }
    console.log('--- Fertig! Alle Sonoff- und Energie-Aliase wurden angelegt. ---');
}

setupAliases();