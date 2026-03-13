// --- KONFIGURATION & KONSTANTEN ---
const IDS = {
    batSoc:      "modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)",
    minSocWrite: "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
    minSocRead:  "modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
    zigbeeDoor:  "zigbee.0.00158d0005435fe1.opened",
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
    return (month >= 10 || month <= 3);
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
    const token = getState(IDS.gotifyToken).val;
    if (token) {
        // Umlaute/Sonderzeichen URL-konform machen oder curl-Parameter sauber halten
        exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker: PV" -F "message=${msg}" -F "priority=${prio}"`);
    }

    // 3. Sprachausgabe (SayIt) - nur tagsüber
    if (speak && compareTime("08:00", "20:00", "between")) {
        sendTo("sayit", "say", { text: msg });
    }
}

// --- LOGIK: SCHONUNG (Golden Hour) ---

schedule({ astro: "goldenHour", shift: 0 }, async () => {
    // Abbrechen, wenn bereits eine "Voll"-Meldung heute kam
    if (messageSent) return;

    const soc = getState(IDS.batSoc).val;
    const minSoc = getState(IDS.minSocRead).val;

    // Kriterien: Winter UND Akku nicht voll (<84%) UND MinSoc ist noch niedrig (<40%)
    if (isWinter() && soc < 84 && minSoc < 40) {

        setState(IDS.minSocWrite, 40);

        notify(
            `Schonung des Speichers im Winterhalbjahr: 🔋 Min SoC wurde auf 40 % festgelegt, weil der Speicher nicht vollgeladen wurde.\n\n Akkustand: ${soc} %.`,
            false,
            1
        );
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

    // Speicher ist voll (Definition hier: exakt 96% erreicht, vorher weniger)
    // Anmerkung: 96% scheint hier der eingestellte Max-Ladezustand zu sein.
    if (soc === 96 && oldSoc < 96 && !messageSent) {

        notify("👌 Bingo! Die Hausbatterie ist aufgeladen.", true, 1);
        messageSent = true;

        // --- SONDERLOGIK WINTER & TÜR/FENSTER ---
        // Wenn Winter UND MinSoC > 20%
        const minSoc = getState(IDS.minSocRead).val;

        if (minSoc > 20 && isWinter()) {

            // Prüfen, ob Zigbee-Sensor (z.B. Saunatür/Fenster?) offen ist
            const isDoorOpen = getState(IDS.zigbeeDoor).val;

            // Wenn MinSoC noch nicht 30 ist UND Tür offen -> Setze auf 30%
            if (minSoc !== 30 && isDoorOpen) {
                setState(IDS.minSocWrite, 30);

                notify("Winterhalbjahr: 🔋Min SoC wurde auf 30% festgelegt (Auslöser: Tür offen bei voller Batterie).", false, 1);
            }
        }
    }
});
