/**
 * =============================================================================
 * MÜLL-ERINNERUNG v2.0
 * =============================================================================
 * ZWECK: Sendet am Vorabend eine Benachrichtigung, wenn Müll abgeholt wird.
 * VERBESSERUNGEN:
 * - Konstanten für alle IDs zur besseren Wartbarkeit.
 * - Gekapselte notify-Funktion für sauberen Code.
 * =============================================================================
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
    daysLeft: 'trashschedule.0.next.daysLeft',
    trashTypes: 'trashschedule.0.next.typesText',
};

// --- 3. HAUPTLOGIK ---

// Trigger: Jeden Sonntag bis Freitag um 18:00 Uhr
schedule("0 18 * * 0-5", async () => {
    const daysLeft = getState(CONFIG.daysLeft).val;

    if (daysLeft === 1) {
        const muellSorte = getState(CONFIG.trashTypes).val;
        const muellText = `Morgen wird ${muellSorte} abgeholt.`;

        // Globale Benachrichtigung mit Sprachausgabe
        await sendGlobalNotify(`🚮 ${muellText}`, "Müll", 5, 40);
    }
});
