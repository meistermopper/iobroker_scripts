// --- KONFIGURATION ---
const ID_ZONE_MAIN = 'denon.0.zoneMain.powerZone';
const ID_ZONE_2    = 'denon.0.zone2.powerZone';
const ID_RESULT    = '0_userdata.0.heos.Wohnzimmer.Marantz_läuft';

// --- LOGIK ---
on({ id: [ID_ZONE_MAIN, ID_ZONE_2], change: 'ne' }, () => {
    const mainAn = getState(ID_ZONE_MAIN).val;
    const zone2An = getState(ID_ZONE_2).val;

    // Wenn Main ODER Zone 2 an ist, setze den Status auf true
    const laeuft = (mainAn || zone2An);
    
    setState(ID_RESULT, laeuft, true); // true am Ende steht für 'ack' (bestätigt)
    
    //console.log(`[Marantz-Check] Status aktualisiert: ${laeuft ? 'Läuft' : 'Aus'}`);
});