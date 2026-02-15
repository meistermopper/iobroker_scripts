// --- KONFIGURATION ---
const ID_MIN_SOC = 'modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)';
// Hier brauchen wir die Variable oder den Datenpunkt aus dem Saunaskript
const ID_SAUNA_AKTIV = '0_userdata.0.Energie.Sauna_aktiv_Logik'; // Falls du eine Variable nutzt, sonst via Global-Variable

// --- LOGIK ---

on({ id: ID_MIN_SOC, change: 'ne' }, async (obj) => {
    const neuerWert = obj.state.val;
    const alterWert = obj.oldState.val;

    if (neuerWert === alterWert) return;

    const text = `🪫 Min-SoC Update: Die Hausbatterie wurde auf ${neuerWert}% geregelt.`;

    // PRÜFUNG: Ist die Sauna aktiv? 
    // (Hinweis: Falls 'saunaAktiv' eine Variable im anderen Skript ist, 
    // sollte sie am besten in einen Datenpunkt geschrieben werden)
    let saunaLaeuft = false;
    if (existsState(ID_SAUNA_AKTIV)) {
        saunaLaeuft = getState(ID_SAUNA_AKTIV).val;
    }

    if (saunaLaeuft) {
        // Nur Logging, kein Telegram-Spam während der Sauna
        console.log(`Sauna-Modus: Telegram unterdrückt. Wert stieg auf ${neuerWert}%.`);
    } else {
        // Normalbetrieb: Telegram senden
        sendTo('telegram', 'send', {
            text: text
        });
        console.warn(`Battery-Log: ${text}`);
    }
});