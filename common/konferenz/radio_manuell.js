// --- KONFIGURATION ---
const playerID = "heos.0.players.820887846";
const senderDP = "0_userdata.0.heos.heos5.sender";
const statusDP = "0_userdata.0.heos.heos5.radio_status";
const volumeLevel = 25;

// Tabelle der Sender und ihrer Presets
const senderMap = {
    'jazzgroove': 1,
    'jazzradio':  2,
    'smoothjazz': 3,
    'hr1':         4,
    'hrinfo':      5,
    'swissjazz':   6,
    'mdrkultur':   7,
    'ffh':         9
};

// --- LOGIK ---

// 1. Trigger: Wenn ein Sender ausgewählt wird
on({id: senderDP, change: "any"}, function (obj) {
    const senderName = obj.state.val;
    const preset = senderMap[senderName];

    if (preset !== undefined) {
        // Befehl: Lautstärke setzen und Preset abspielen
        const command = `set_volume&level=${volumeLevel}|play_preset&preset=${preset}`;
        setState(`${playerID}.command`, command);
        
        // Status verzögert auf true setzen, damit der erste Trigger (unten) reagiert
        setStateDelayed(statusDP, true, 1000, false);
        
        console.log(`HEOS: Sender ${senderName} (Preset ${preset}) an Player ${playerID} gesendet.`);
    } else if (senderName === "" || senderName === "none") {
        // Optional: Player stoppen, wenn Sender gelöscht wird
        setState(statusDP, false);
    } else {
        console.warn(`HEOS: Sender "${senderName}" ist nicht in der senderMap definiert.`);
    }
});

// 2. Trigger: Wenn sich der radio_status (Play/Stop) ändert
on({id: statusDP, change: "ne"}, function (obj) {
    // Falls true -> 'play', falls false -> 'stop'
    const playCommand = obj.state.val ? 'play' : 'stop';
    setState(`${playerID}.state`, playCommand);
    
    console.log(`HEOS: Player Status auf ${playCommand} gesetzt.`);
});