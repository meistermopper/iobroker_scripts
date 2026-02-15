/**
 * Name:   Navigations-Ansage Ziegenhain
 * Zweck:  Sprachausgabe bei Trigger und automatischer Reset des Datenpunkts
 */

const ID_TRIGGER = '0_userdata.0.Sonstige.Trigger.Ziegenhain';
let ziegenhainTimer = null;

on({ id: ID_TRIGGER, change: 'any' }, (obj) => {
    // Nur ausführen, wenn der Trigger auf "true" (oder ungleich 0/leer) geht
    if (!obj.state.val) return;

    // Falls der Trigger innerhalb der 3s nochmal gedrückt wird: Alten Timer löschen
    if (ziegenhainTimer) clearTimeout(ziegenhainTimer);

    ziegenhainTimer = setTimeout(() => {
        // 1. Sprachausgabe via SayIt
        sendTo("sayit", "say", { 
            text: 'Okay, die Route zu den Lattich-Köppen nach Ziegenhain wird berechnet!' 
        });

        // 2. Datenpunkt nach der Ansage wieder auf false setzen (bestätigt)
        setState(ID_TRIGGER, false, true);

        log('Navigation: Route nach Ziegenhain wird angesagt.');
        ziegenhainTimer = null;
    }, 3000);
});