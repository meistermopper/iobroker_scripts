// --- KONFIGURATION ---
const PATH_ENTPRELLEN = '0_userdata.0.Entprellen.Medien.VUSolo4K.';
const PATH_ENIGMA     = 'enigma2.0.command.';

// Hier verknüpfen wir einfach Quelle und Ziel
const buttonMapping = {
    'down':       'DOWN',
    'left':       'LEFT',
    'right':      'RIGHT',
    'up':         'UP',
    'exit':       'EXIT',
    'ok':         'OK',
    'play_pause': 'PLAY_PAUSE'
};

let triggersperre = false;

// Wir triggern auf alle im Mapping definierten Datenpunkte
const triggerIds = Object.keys(buttonMapping).map(key => PATH_ENTPRELLEN + key);

on({ id: triggerIds, change: "ne", val: true }, (obj) => {
    if (triggersperre) return;

    // Welcher Button wurde gedrückt? (z.B. "down")
    const buttonKey = obj.id.replace(PATH_ENTPRELLEN, '');
    const enigmaCmd = buttonMapping[buttonKey];

    if (enigmaCmd) {
        triggersperre = true;
        
        // Befehl an Enigma senden
        setState(PATH_ENIGMA + enigmaCmd, true);
        
        // Sperre nach 100ms aufheben
        setTimeout(() => {
            triggersperre = false;
        }, 100);
    }
});