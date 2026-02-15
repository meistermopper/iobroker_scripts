// --- KONFIGURATION ---
const dpJsonHeute = '0_userdata.0.Energie.PV.Prognose..heute.Json';
const dpGesamt    = '0_userdata.0.Energie.PV.Prognose..heute.gesamt';
const dpUhrzeit   = '0_userdata.0.Energie.PV.Prognose..heute.uhrzeit';
const dpLeistung  = '0_userdata.0.Energie.PV.Prognose..heute.leistung';

// --- LOGIK ---
on({ id: dpJsonHeute, change: 'ne' }, (obj) => {
    const data = obj.state.val;

    // Prüfen, ob Daten vorhanden und ein Array sind
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('Solarprognose: JSON-Daten sind leer oder ungültig.');
        return;
    }

    // 1. Gesamtertrag extrahieren (letztes Element im Array)
    const gesamtEintrag = data.slice(-1)[0];
    if (gesamtEintrag && gesamtEintrag.length >= 3) {
        setState(dpGesamt, gesamtEintrag[2], true);
    }

    // 2. Maximum (Peak) finden
    let maxLeistung = 0;
    let peakUhrzeit = '';

    // Iteration durch die Stunden-Werte
    for (let i = 0; i < data.length; i++) {
        const eintrag = data[i];
        const leistung = eintrag[1];
        const uhrzeit = eintrag[0];

        // Wenn die Leistung höher als das bisherige Max ist (und es kein Info-String ist)
        if (typeof leistung === 'number' && leistung > maxLeistung) {
            maxLeistung = leistung;
            peakUhrzeit = uhrzeit;
        }
    }

    // Werte schreiben
    if (peakUhrzeit !== '') {
        setState(dpUhrzeit, peakUhrzeit, true);
        setState(dpLeistung, maxLeistung, true);
        console.log(`Solarprognose: Peak heute um ${peakUhrzeit} Uhr mit ${maxLeistung} W.`);
    }
});