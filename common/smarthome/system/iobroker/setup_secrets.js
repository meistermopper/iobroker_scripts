/**
 * Name:   Setup Secrets Datapoints
 * Zweck:  Legt die benötigten Datenpunkte für API-Tokens, Zugangsdaten und VINs an, 
 *         damit diese nicht im Klartext in den Skripten stehen müssen.
 * 
 * Nutzung: Skript einmal ausführen, danach können die Werte im ioBroker-Objektbaum 
 *          eingetragen werden. Das Skript kann danach deaktiviert oder gelöscht werden.
 */

// --- LOGIK ---
const datapoints = [
    {
        id: "0_userdata.0.Unifi.user",
        name: "Unifi Username",
        type: "string",
        role: "text"
    },
    {
        id: "0_userdata.0.Unifi.password",
        name: "Unifi Password",
        type: "string",
        role: "text"
    },
    {
        id: "0_userdata.0.Energie.PV.Prognose.token",
        name: "Solarprognose API Token",
        type: "string",
        role: "text"
    },
    {
        id: "0_userdata.0.Energie.Kia_e_niro.vin",
        name: "Kia Fahrgestellnummer (VIN)",
        type: "string",
        role: "text"
    }
];

// Datenpunkte anlegen
datapoints.forEach(dp => {
    createState(dp.id, "", true, {
        name: dp.name,
        desc: "Automatisch angelegt für Secrets-Auslagerung",
        type: dp.type,
        role: dp.role,
        read: true,
        write: true
    }, () => {
        console.log(`[Setup Secrets] Datenpunkt angelegt: ${dp.id}`);
    });
});

console.log("[Setup Secrets] Alle Erstellungsaufträge gesendet. Bitte prüfen Sie den Objektbaum unter 0_userdata.0 und tragen Sie die Werte ein.");
