// --- KONFIGURATION & KONSTANTEN ---
const IDS = {
    batSoc:      "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)",
    minSocWrite: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
    minSocRead:  "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
    gotifyToken: "0_userdata.0.gotifytoken.iobroker"
};

let messageSent = false;

// --- HILFSFUNKTIONEN ---

/**
 * Prüft, ob wir uns im Winterhalbjahr befinden (Oktober bis März).
 * @returns {boolean}
 */
function isWinter() {
    const month = new Date().getMonth() + 1; // 1-12
    return (month >= 10 || month <= 2);
}

/**
 * Zentrale Benachrichtigungsfunktion (Telegram, Gotify, SayIt)
 * @param {string} msg - Die Nachricht
 * @param {boolean} [speak=false] - Soll der Text gesprochen werden?
 * @param {number} [prio=5] - Priorität für Gotify
 */
function notify(msg, speak = false, prio = 5) {
    // 1. Telegram
    sendTo("telegram", "send", { text: msg });

    // 2. Gotify
    const token = getState(IDS.gotifyToken)?.val;
    if (token) {
        // Umlaute/Sonderzeichen URL-konform machen oder curl-Parameter sauber halten
        exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker: PV" -F "message=${msg}" -F "priority=${prio}"`);
    }

    // 3. Sprachausgabe (SayIt) - nur tagsüber
    if (speak && compareTime("08:00", "20:00", "between")) {
        const cleanMsg = msg.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF])/g, "");
        sendTo("sayit", "say", { text: cleanMsg });
    }
}

// --- LOGIK: SCHONUNG (Golden Hour) ---

schedule({ astro: "goldenHour", shift: 0 }, async () => {
    // Abbrechen, wenn bereits eine "Voll"-Meldung heute kam
    if (messageSent) return;

    const soc = getState(IDS.batSoc)?.val;
    const minSoc = getState(IDS.minSocRead)?.val;
    const month = new Date().getMonth() + 1;

    // Kriterium: Akku wurde nicht voll (< 84%)
    if (soc < 84) {
        // Winter-Logik (Oktober - Februar): MinSoC auf 40% anheben, falls er niedriger ist.
        if ((month >= 10 || month <= 2) && minSoc < 40) {
            setState(IDS.minSocWrite, 40);
            notify(
                `Schonung des Speichers im Winter: 🔋 Min SoC wurde auf 40 % festgelegt, weil der Speicher nicht vollgeladen wurde.\n\n Akkustand: ${soc} %.`,
                false,
                1
            );
        }
        // Übergangs-Logik (März): MinSoC auf 30% anheben, falls er niedriger ist.
        else if (month === 3 && minSoc < 30) {
            setState(IDS.minSocWrite, 30);
            notify(
                `Schonung des Speichers im Übergang: 🔋 Min SoC wurde auf 30 % festgelegt, weil der Speicher nicht vollgeladen wurde.\n\n Akkustand: ${soc} %.`,
                false,
                1
            );
        }
    }
});

// --- LOGIK: RESET (Mitternacht) ---
schedule("59 0 * * *", async () => {
    messageSent = false;
});

// --- LOGIK: LADESTAND ÜBERWACHUNG ---

on({ id: IDS.batSoc, change: "ne" }, async (obj) => {
    const soc = obj.state.val;
    const oldSoc = obj.oldState ? obj.oldState.val : 0;

    // Speicher ist voll
    if (soc === 100 && oldSoc < 100 && !messageSent) {

        notify("👌 Der Stromspeicher ist voll", true, 1);
        messageSent = true;

        // --- SONDERLOGIK WINTER ---
        // Wenn Winter UND MinSoC > 20%
        const minSoc = getState(IDS.minSocRead)?.val;

        if (minSoc > 20 && isWinter()) {
            // Wenn MinSoC noch nicht 30 ist -> Setze auf 30%
            if (minSoc !== 30) {
                setState(IDS.minSocWrite, 30);
                notify("Winterhalbjahr: 🔋Min SoC wurde auf 30% festgelegt (Auslöser: Batterie voll).", false, 1);
            }
        }
    }
});
