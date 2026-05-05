/**
 * Name:   Büro Chromecast Steuerung
 * Zweck:  Synchronisierung von Status-Datenpunkten und Senderwahl
 */

// --- KONFIGURATION ---
const CHROMECAST_ID = "chromecast.0.Mini-Buero";
const USER_DATA_BASE = "0_userdata.0.heos.Buero";

const STREAM_URLS = {
    'jazzgroove': 'http://aac-64.streamthejazzgroove.com/stream',
    'jazzradio':  'http://streaming.radio.co:80/s774887f7b/listen',
    'smoothjazz': 'http://sj64.hnux.com/;',
    'hr1':        'https://dispatcher.rndfnk.com/hr/hr1/live/mp3/high',
    'hrinfo':     'http://addrad.io/4WRF2F',
    'swissjazz':  'http://stream.srg-ssr.ch/m/rsj/aacp_96',
    'mdrkultur':  'http://mdr-284310-0.cast.mdr.de/mdr/284310/0/aac/high/stream.aac?ar-distributor=f0a1',
    'ffh':        'http://streams.ffh.de/radioffh/aac/playerid:RTFFHTunein/hqlivestream.aac'
};

// --- LOGIK ---

// 1. App-Status (TuneIn / Spotify) synchronisieren
on({id: `${CHROMECAST_ID}.status.displayName`, change: "ne"}, (obj) => {
    const appName = obj.state.val;

    // Setzt tunein/spotify auf true/false basierend auf dem App-Namen
    setState(`${USER_DATA_BASE}.tunein`, appName === 'TuneIn Free', true);
    setState(`${USER_DATA_BASE}.spotify`, appName === 'Spotify', true);
});

// 2. Player-Status (Playing / Idle) synchronisieren
on({id: `${CHROMECAST_ID}.status.playerState`, change: "ne"}, (obj) => {
    const state = obj.state.val;
    const isPlaying = (state === 'playing');

    // Setzt radio_status auf true wenn 'playing', sonst false
    setState(`${USER_DATA_BASE}.radio_status`, isPlaying, true);
});

// 3. Sender-Umschalter
on({id: `${USER_DATA_BASE}.tunein_sender`, change: "any"}, (obj) => {
    const url = STREAM_URLS[obj.state.val];

    if (url) {
        setStateDelayed(`${CHROMECAST_ID}.player.url2play`, url, 500, false);
        console.log(`Büro Chromecast: Spiele Sender ${obj.state.val} von URL ${url}`);
    } else {
        console.warn(`Büro Chromecast: Unbekannter Sender ${obj.state.val}`);
    }
});
