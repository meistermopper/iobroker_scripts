// --- KONFIGURATION ---
const dpJsonMorgen = '0_userdata.0.Energie.PV.Prognose..morgen.Json';
const dpGesamt     = '0_userdata.0.Energie.PV.Prognose..morgen.gesamt';
const dpUhrzeit    = '0_userdata.0.Energie.PV.Prognose..morgen.uhrzeit';
const dpLeistung   = '0_userdata.0.Energie.PV.Prognose..morgen.leistung';

// --- LOGIK ---
on({ id: dpJsonMorgen, change: 'ne' }, (obj) => {
    const data = obj.state.val;

    // Sicherheitscheck
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('Solarprognose Morgen: JSON-Daten sind leer oder ungültig.');
        return;
    }

    // 1. Gesamtertrag morgen (letztes Element im Array)
    const gesamtEintrag = data.slice(-1)[0];
    if (gesamtEintrag && gesamtEintrag.length >= 3) {
        setState(dpGesamt, gesamtEintrag[2], true);
    }

    // 2. Peak morgen finden
    let maxLeistung = 0;
    let peakUhrzeit = '';

    for (let i = 0; i < data.length; i++) {
        const eintrag = data[i];
        const leistung = eintrag[1];
        const uhrzeit = eintrag[0];

        // Nur numerische Werte vergleichen (verhindert Fehler durch Text-Elemente)
        if (typeof leistung === 'number' && leistung > maxLeistung) {
            maxLeistung = leistung;
            peakUhrzeit = uhrzeit;
        }
    }

    // Werte schreiben
    if (peakUhrzeit !== '') {
        setState(dpUhrzeit, peakUhrzeit, true);
        setState(dpLeistung, maxLeistung, true);
        console.log(`Solarprognose Morgen: Erwarteter Peak um ${peakUhrzeit} Uhr mit ${maxLeistung} W.`);
    }
});