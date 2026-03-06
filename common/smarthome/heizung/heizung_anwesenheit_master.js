/**
 * Name:   Heizungs- & Anwesenheits-Master (V8)
 * Release: Korrektur Badezimmer Oben (Master-Slave)
 * System: Steuert Heizprofile basierend auf Anwesenheit, Kalender & Sonderprogrammen
 */

// --- 1. KONFIGURATION DER GERÄTE ---
const HEIZUNGEN = {
    kueche:       'alias.0.kueche.heizung.ACTIVE_PROFILE',
    wohnzimmer:   'alias.0.wohnzimmer.heizung.ACTIVE_PROFILE',
    schlafzimmer: 'alias.0.schlafzimmer.heizung.ACTIVE_PROFILE',
    bad_unten:    'alias.0.bad_unten.heizung.ACTIVE_PROFILE',
    buero:        'alias.0.buero.heizung.ACTIVE_PROFILE',
    konferenz:    'alias.0.konferenz.heizung.ACTIVE_PROFILE',
    gast_oben:    'alias.0.gast_oben.heizung.ACTIVE_PROFILE',
    gast_unten:   'alias.0.gast_unten.heizung.ACTIVE_PROFILE',
    bad_oben:     'alias.0.bad_oben.heizung.ACTIVE_PROFILE' // Korrigiert: Nur noch ein Master-DP
};

// --- 2. DATENPUNKTE DER PROGRAMME ---
const PROG = {
    AUSSERHAUS: '0_userdata.0.Heizen.Programme.Ausserhaus',
    ZUHAUSE:    '0_userdata.0.Heizen.Programme.Zuhause',
    STANDARD:   '0_userdata.0.Heizen.Programme.standard',
    GAST_OBEN:  '0_userdata.0.Heizen.Programme.Gast_oben',
    GAST_UNTEN: '0_userdata.0.Heizen.Programme.Gast_unten',
    TAGUNG:     '0_userdata.0.Heizen.Programme.Tagung'
};

const KALENDER_IDS = [
    'ical.1.events.0.today.Urlaub',
    'ical.1.events.0.today.dienstfrei',
    'feiertage.0.heute.boolean'
];

// --- 3. LOGIK: KALENDER -> AUTOMATISCHER STATUS ---
on({ id: KALENDER_IDS, change: 'ne' }, () => {
    const istFrei = getState('ical.1.events.0.today.Urlaub').val || 
                    getState('ical.1.events.0.today.dienstfrei').val || 
                    getState('feiertage.0.heute.boolean').val;
    
    if (!getState(PROG.AUSSERHAUS).val) {
        setState(PROG.ZUHAUSE, istFrei, true);
        console.log(`[Heizung] Kalender-Update: Zuhause-Modus ist nun ${istFrei}`);
    }
});

// --- 4. LOGIK: SONDERPROGRAMME (GAST / TAGUNG) ---
on({ id: [PROG.GAST_OBEN, PROG.GAST_UNTEN, PROG.TAGUNG], change: 'ne' }, (obj) => {
    const aktiv = !!obj.state.val;
    const profil = aktiv ? 2 : 1;
    let name = "";

    if (obj.id === PROG.GAST_OBEN) {
        name = "Gästezimmer & Bad oben";
        setState(HEIZUNGEN.gast_oben, profil);
        setStateDelayed(HEIZUNGEN.bad_oben, profil, 1000, false); // Master-DP
    } else if (obj.id === PROG.GAST_UNTEN) {
        name = "Gästezimmer unten";
        setState(HEIZUNGEN.gast_unten, profil);
    } else if (obj.id === PROG.TAGUNG) {
        name = "Konferenzraum & Bad oben";
        setState(HEIZUNGEN.konferenz, profil);
        setStateDelayed(HEIZUNGEN.bad_oben, profil, 1000, false); // Master-DP
    }

    const msg = `⚙️ Programm für ${name} wurde ${aktiv ? 'gestartet' : 'beendet'}.`;
    console.log(`[Heizung] ${msg}`);
    sendTo("telegram", "send", { text: msg });
});

// --- 5. LOGIK: HAUPT-MODI (AUSSERHAUS / ZUHAUSE) ---
on({ id: [PROG.AUSSERHAUS, PROG.ZUHAUSE], change: 'ne' }, (obj) => {
    const weg = getState(PROG.AUSSERHAUS).val;
    const hier = getState(PROG.ZUHAUSE).val;

    if (weg) {
        setState(PROG.ZUHAUSE, false, true);
        setState(PROG.STANDARD, false, true);
        setMainProfiles(3, '✈️ Außerhausmodus aktiv (Absenkprofil)');
        
        // Zusatzgeräte
        setState('alias.0.kueche.boiler.POWER', false);
        setStateDelayed('enigma2.0.main_command.DEEP_STANDBY', true, 3000, false);
        setStateDelayed('enigma2.1.main_command.DEEP_STANDBY', true, 6000, false);
    } else if (hier) {
        setState(PROG.STANDARD, false, true);
        setState('alias.0.kueche.boiler.POWER', true);
        setMainProfiles(1, '⛱️ Modus Urlaub/Zuhause aktiv (Komfortprofil)');
    } else {
        setState(PROG.STANDARD, true, true);
        setMainProfiles(3, '👨‍💻 Standard-Modus aktiv (Profil 3)');
    }
});

// --- 6. HILFSFUNKTION: PROFIL-VERTEILER ---
function setMainProfiles(profil, msg) {
    sendTo('telegram', 'send', { text: msg });
    console.log(`[Heizung] ${msg}`);

    // Standard-Räume
    setState(HEIZUNGEN.kueche, profil);
    setStateDelayed(HEIZUNGEN.wohnzimmer, profil, 2000, false);
    setStateDelayed(HEIZUNGEN.schlafzimmer, profil, 4000, false);
    setStateDelayed(HEIZUNGEN.bad_unten, profil, 6000, false);
    setStateDelayed(HEIZUNGEN.buero, profil, 8000, false);

    // Sonder-Räume mit "Sperr-Abfrage"
    if (!getState(PROG.TAGUNG).val) {
        setStateDelayed(HEIZUNGEN.konferenz, profil, 10000, false);
    }
    if (!getState(PROG.GAST_UNTEN).val) {
        setStateDelayed(HEIZUNGEN.gast_unten, profil, 12000, false);
    }
    // Bad Oben wird nur geschaltet, wenn weder Gast Oben noch Tagung aktiv sind
    if (!getState(PROG.GAST_OBEN).val && !getState(PROG.TAGUNG).val) {
        setStateDelayed(HEIZUNGEN.gast_oben, profil, 14000, false);
        setStateDelayed(HEIZUNGEN.bad_oben, profil, 16000, false); // Master-DP
    }
}