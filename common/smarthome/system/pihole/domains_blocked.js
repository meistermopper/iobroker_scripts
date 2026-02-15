// Konfiguration der Pi-hole Server und Datenpunkte
const piholeServers = [
    // Struktur: 0_userdata.0.Pihole.piholeX.UniqueGravityDomains
    { host: 'pihole', datapoint: '0_userdata.0.Pihole.pihole0.UniqueGravityDomains' },
    { host: 'rpifr24', datapoint: '0_userdata.0.Pihole.pihole1.UniqueGravityDomains' }
];

// Funktion zum Erstellen der Datenpunkte, falls diese noch nicht existieren
function createDataPoints() {
    piholeServers.forEach(server => {
        createState(server.datapoint, 0, {
            name: `Anzahl der einzigartigen Domains auf ${server.host}`,
            type: 'number',
            role: 'value',
            unit: 'Domains'
        });
    });
    console.log("Struktur der Pi-hole Datenpunkte erstellt oder geprüft.");
}

// Hauptfunktion zum Abrufen und Aktualisieren der Daten
function updatePiHoleData() {
    //console.log("Starte tägliche Pi-hole Datenaktualisierung...");

    // SQL-Befehl: Jetzt werden die inneren doppelten Anführungszeichen escaped,
    // während die einfachen Anführungszeichen ('gravity_count') direkt stehen bleiben können,
    // da sie vom äußeren Doppel-Anführungszeichen-Kontext geschützt werden.
    const sqlQuery = "SELECT value FROM info WHERE property = 'gravity_count';"; 

    piholeServers.forEach(server => {
        // ENDGÜLTIGE LÖSUNG: Äußeres JS-Kommando in Backticks.
        // Das SSH-Kommando wird von doppelten Anführungszeichen (`"`) umschlossen.
        // Die innere Anführungszeichenstruktur muss von der Datenbank die einfachen Anführungszeichen erhalten.
        const command = `ssh thomas@${server.host} "sudo pihole-FTL sqlite3 /etc/pihole/gravity.db \\"${sqlQuery}\\""`;
        // HINWEIS: Dies ist die robusteste Form der Verschachtelung, die die innere einfache Anführungszeichenkette
        // an die SQLite-Engine weitergibt, indem die äußeren Doppel-Anführungszeichen escaped werden.

        require('child_process').exec(command, function(error, stdout, stderr) {
            if (error) {
                console.error(`Fehler bei SSH-Verbindung zu ${server.host}: ${error.message}`);
                console.error(`[${server.host}] Fehlerdetails: ${stderr}`);
                return;
            }
            if (stderr) {
                console.error(`Stderr von ${server.host}: ${stderr}`);
            }
            
            const domainCount = parseInt(stdout.trim(), 10);
            
            if (!isNaN(domainCount)) {
                setState(server.datapoint, domainCount, true);
                //console.log(`[${server.host}] Domainanzahl erfolgreich aktualisiert: ${domainCount}`);
            } else {
                console.error(`[${server.host}] Konvertierung der Domainanzahl fehlgeschlagen: ${stdout}`);
            }
        });
    });
}

// 1. Datenpunkte beim Skriptstart erstellen/prüfen
createDataPoints();

// 2. Skript beim Start einmalig ausführen
updatePiHoleData();

// 3. Täglich um 01:25 Uhr morgens aktualisieren
// Die Cron-Syntax ist: 'Minuten Stunden * * *'
schedule('25 1 * * *', updatePiHoleData);