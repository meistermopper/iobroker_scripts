/**
 * Name:   Reinigungsmodus-Steuerung
 * Zweck:  Deaktiviert/Aktiviert BWM-Automatiken kaskadiert
 */

const BWM_DATENPUNKTE = [
    { id: "0_userdata.0.Licht.Bad_oben.BWM", delay: 0 },
    { id: "0_userdata.0.Licht.Bad_unten.BWM", delay: 1000 }
];

on({ id: "0_userdata.0.Licht.Reinigungsmodus", change: "ne" }, (obj) => {
    const aktiv = obj.state.val; // true oder false
    
    // Wir setzen alle BWMs auf das Gegenteil des Reinigungsmodus
    // Reinigungsmodus AN (true) -> BWM AUS (false)
    // Reinigungsmodus AUS (false) -> BWM AN (true)
    const bwmStatus = !aktiv;

    BWM_DATENPUNKTE.forEach(bwm => {
        if (bwm.delay === 0) {
            setState(bwm.id, bwmStatus);
        } else {
            setStateDelayed(bwm.id, bwmStatus, bwm.delay, false);
        }
    });

    const logMsg = `Reinigungsmodus wurde ${aktiv ? 'aktiviert' : 'deaktiviert'}`;
    console.log(logMsg);
});