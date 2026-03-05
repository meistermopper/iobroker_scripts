// Nur 1x nachts um 03:00 Uhr: Cache leeren und Seite frisch laden
schedule("0 3 * * *", async () => {
    setState('fullybrowser.0.Fully-Browser.Commands.clearCache', true, true);
    // 2 Sekunden warten, damit der Cache-Löschvorgang sicher durch ist
    setTimeout(() => {
        setState('fullybrowser.0.Fully-Browser.Commands.loadURL', 'http://192.168.178.10:8082/vis/index.html?projektx#100_Startseite');

        // NEU: Nach weiteren 5 Sekunden das Display wieder ausschalten, um sicherzustellen, dass die Seite geladen ist.
        setTimeout(() => {
            setState('fullybrowser.0.Fully-Browser.Commands.screenOff', true);
        }, 5000); // 5 Sekunden Puffer
    }, 2000);
});

// Optional: Falls sich das Tablet tagsüber aufhängt, reicht ein einfacher Reload OHNE Cache-Löschen (z.B. alle 4 Stunden)
//schedule("0 7,11,15,19 * * *", async () => {
//    setState('fullybrowser.0.Fully-Browser.Commands.loadURL', 'http://192.168.178.10:8082/vis/index.html?projektx#100_Startseite');
//});