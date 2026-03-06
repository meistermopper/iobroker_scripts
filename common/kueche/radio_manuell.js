// --- KONFIGURATION ---

// IDs HEOS
const heosPlayerID = "heos.0.players.820887846";
const heosSenderDP = "0_userdata.0.heos.heos5.sender";
const heosStatusDP = "0_userdata.0.heos.heos5.radio_status";
const heosVolume   = 25;

// IDs Chromecast Küche
const chromeID     = 'chromecast.0.d86c63581a19';
const chromePath   = '0_userdata.0.heos.Kueche';
const chromeVolume = 15; // Standardlautstärke für die Küche (0-100)

// Mapping: HEOS Presets
const heosPresets = {
    'jazzgroove': 1, 'jazzradio': 2, 'smoothjazz': 3, 'hr1': 4,
    'hrinfo': 5, 'swissjazz': 6, 'mdrkultur': 7, 'ffh': 9
};

// Mapping: Chromecast URLs
const chromeStreams = {
    'jazzgroove': 'http://aac-64.streamthejazzgroove.com/stream',
    'jazzradio':  'http://streaming.radio.co:80/s774887f7b/listen',
    'smoothjazz': 'https://smoothjazz.cdnstream1.com/2585_128.mp3',
    'hr1':         'https://dispatcher.rndfnk.com/hr/hr1/live/mp3/high',
    'hrinfo':      'http://addrad.io/4WRF2F',
    'swissjazz':   'http://stream.srg-ssr.ch/m/rsj/aacp_96',
    'mdrkultur':   'http://mdr-284310-0.cast.mdr.de/mdr/284310/0/aac/high/stream.aac?ar-distributor=f0a1',
    'ffh':         'http://streams.ffh.de/radioffh/aac/playerid:RTFFHTunein/hqlivestream.aac'
};

// --- LOGIK HEOS ---

on({id: heosSenderDP, change: "any"}, (obj) => {
    const preset = heosPresets[obj.state.val];
    if (preset) {
        setState(`${heosPlayerID}.command`, `set_volume&level=${heosVolume}|play_preset&preset=${preset}`);
        setStateDelayed(heosStatusDP, true, 1000, false);
    }
});

on({id: heosStatusDP, change: "ne"}, (obj) => {
    setState(`${heosPlayerID}.state`, obj.state.val ? 'play' : 'stop');
});

// --- LOGIK CHROMECAST KÜCHE ---

// 1. Senderwahl & Lautstärke
on({ id: `${chromePath}.sender_tunein`, change: 'any' }, (obj) => {
    const streamUrl = chromeStreams[obj.state.val];
    if (streamUrl) {
        // Erst Lautstärke setzen, dann Stream starten
        setState(`${chromeID}.player.volume`, chromeVolume);
        setStateDelayed(`${chromeID}.player.url2play`, streamUrl, 500, false);
        setState(`${chromePath}.tunein`, true);
        console.log(`Chromecast: Starte ${obj.state.val} mit Volume ${chromeVolume}`);
    }
});

// 2. App-Erkennung
on({ id: `${chromeID}.status.displayName`, change: 'ne' }, (obj) => {
    setState(`${chromePath}.tunein`, (obj.state.val === 'TuneIn Free'));
    setState(`${chromePath}.spotify`, (obj.state.val === 'Spotify'));
});

// 3. Play/Pause Synchronisierung
on({ id: `${chromeID}.player.state`, change: 'ne' }, (obj) => {
    setState(`${chromePath}.radio_status`, (obj.state.val === 'playing'));
});