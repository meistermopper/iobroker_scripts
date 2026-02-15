// --- KONFIGURATION ---
const ID_TRIGGER = '0_userdata.0.Energie.Switch.Neustart';
const ID_SWITCH  = 'alias.0.buero.schalter.POWER';
const RESET_PAUSE = 3000; // 3 Sekunden Pause

let neustartTimer = null;

// --- LOGIK ---

on({ id: ID_TRIGGER, change: 'gt' }, (obj) => {
    console.log('KVM-Switch Neustart ausgelöst: Schalte aus...');
    
    // Bestehende Timer löschen, falls jemand doppelt klickt
    if (neustartTimer) {
        clearTimeout(neustartTimer);
        neustartTimer = null;
    }

    // 1. Switch ausschalten
    setState(ID_SWITCH, false);

    // 2. Nach Pause wieder einschalten
    neustartTimer = setTimeout(() => {
        setState(ID_SWITCH, true);
        
        // Trigger wieder zurücksetzen (Ack: true, damit die On-Bedingung nicht erneut feuert)
        setState(ID_TRIGGER, false, true);
        
        console.log('KVM-Switch erfolgreich neu gestartet.');
        neustartTimer = null;
    }, RESET_PAUSE);
});