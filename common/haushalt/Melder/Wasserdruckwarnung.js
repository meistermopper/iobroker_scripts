/**
 * Name:   Heizung Wasserdruck Überwachung v1.2
 * Zweck:  Warnt, wenn der Druck unter die Schwelle fällt.
 */

// --- KONFIGURATION ---
const ID_DRUCK = 'vaillant.0.44c040a5-2e4f-4933-b508-22584e0854c2.state.system.systemWaterPressure';
const ID_STATUS_DP = '0_userdata.0.Heizen.Status.Wasserdruck';
const SCHWELLE = 1.3; // Druck-Schwelle für Alarm

// --- LOGIK ---
on({ id: ID_DRUCK, change: 'ne' }, async (obj) => {
    const druck = obj.state.val;
    const alterDruck = obj.oldState ? obj.oldState.val : 2.0;

    // Nur auslösen, wenn der Druck NEU unter die Schwelle fällt
    if (druck < SCHWELLE && alterDruck >= SCHWELLE) {

        const msg = `⚠️ Wasserdruck zu niedrig! Aktuell: ${druck.toFixed(1)} Bar. Bitte Wasser auffüllen.`;

        // Logausgabe
        await sendGlobalNotify(msg, "Heizung", 5, compareTime('08:00', '20:00', 'between') ? 50 : null); // Sprachausgabe nur tagsüber
    }
});
