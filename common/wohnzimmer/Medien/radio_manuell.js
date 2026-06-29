// =============================================================================
// MULTIMEDIA-ZENTRALE v2.0 (HARMONY, CHROMECAST, HEOS)
// =============================================================================

// --- 1. DATENPUNKTE ---
const BASE_DP = "0_userdata.0.heos.Wohnzimmer.";
const SOURCE_DPs = ["sat_tv", "tunein", "spotify", "netflix", "heos", "magenta", "online_musik"];

const ID_PLAY_STATUS = BASE_DP + "play_status";
const ID_CC_DISPLAY = "chromecast.0.Mini-Wozi.status.displayName";
const ID_CC_STATE = "chromecast.0.Mini-Wozi.player.state";
const ID_CC_URL = "chromecast.0.Mini-Wozi.player.url2play";
const ID_SENDER_TUNE = BASE_DP + "sender_tunein";

const HARMONY_PREFIX = "harmony.0.Harmony_Wozi.activities.";
const ID_H_STATUS = HARMONY_PREFIX + "currentStatus";

// --- 2. KONFIGURATION (MAPS) ---

const RADIO_STREAMS = {
  jazzgroove: "http://aac-64.streamthejazzgroove.com/stream",
  jazzradio: "http://streaming.radio.co:80/s774887f7b/listen",
  smoothjazz: "http://sj64.hnux.com/;",
  hr1: "https://dispatcher.rndfnk.com/hr/hr1/live/mp3/high",
  hrinfo: "http://addrad.io/4WRF2F",
  swissjazz: "http://stream.srg-ssr.ch/m/rsj/aacp_96",
  mdrkultur: "http://mdr-284310-0.cast.mdr.de/mdr/284310/0/aac/high/stream.aac?ar-distributor=f0a1",
  ffh: "http://streams.ffh.de/radioffh/aac/playerid:RTFFHTunein/hqlivestream.aac",
};

// --- 3. HILFSFUNKTIONEN ---

// Setzt eine Quelle auf true und alle anderen auf false
function setExclusiveSource(activeSource) {
  SOURCE_DPs.forEach((source) => {
    const val = source === activeSource;
    if (existsState(BASE_DP + source)) {
      setState(BASE_DP + source, val);
    }
  });
}

// --- 4. HAUPTLOGIK (TRIGGER) ---

// A: Harmony Aktivitäten
on(
  {
    id: [
      HARMONY_PREFIX + "SAT_TV",
      HARMONY_PREFIX + "Online_Music",
      HARMONY_PREFIX + "Chromecast_Musik",
      HARMONY_PREFIX + "Chromecast_Video",
      ID_H_STATUS,
    ],
    change: "ne",
  },
  () => {
    const hStatus = getState(ID_H_STATUS)?.val;

    if (hStatus === 0) {
      setExclusiveSource(null); // Alles aus
      setState(ID_PLAY_STATUS, false);
    } else {
      setState(ID_PLAY_STATUS, true);
      if (getState(HARMONY_PREFIX + "SAT_TV")?.val === 2) setExclusiveSource("sat_tv");
      else if (getState(HARMONY_PREFIX + "Online_Music")?.val === 2)
        setExclusiveSource("online_musik");
      else if (getState(HARMONY_PREFIX + "Chromecast_Musik")?.val === 2)
        setExclusiveSource("spotify");
      else if (getState(HARMONY_PREFIX + "Chromecast_Video")?.val === 2)
        setExclusiveSource("netflix");
    }
  },
);

// B: Chromecast Metadata Erkennung
on({ id: ID_CC_DISPLAY, change: "ne" }, (obj) => {
  const display = obj.state.val;
  const hMusic = getState(HARMONY_PREFIX + "Online_Music")?.val;
  const heosPlay = getState("heos.0.players.217493250.state")?.val;

  switch (display) {
    case "TuneIn Free":
      setExclusiveSource("tunein");
      break;
    case "Spotify":
      setExclusiveSource("spotify");
      break;
    case "Netflix":
      setExclusiveSource("netflix");
      break;
    default:
      if (hMusic === 2 && heosPlay === "play") setExclusiveSource("heos");
      break;
  }
});

// C: Play-Status Ermittlung (Chromecast & Harmony Kombi)
on({ id: [ID_CC_STATE, HARMONY_PREFIX + "Online_Music"], change: "ne" }, () => {
  const ccState = getState(ID_CC_STATE)?.val;
  const hMusic = getState(HARMONY_PREFIX + "Online_Music")?.val;

  if (hMusic === 0) {
    const isPlaying = ccState === "playing";
    setState(ID_PLAY_STATUS, isPlaying);
  } else if (hMusic === 2) {
    setState(ID_PLAY_STATUS, true);
  }
});

// D: Radiosender Umschalter (TuneIn via Chromecast)
on({ id: ID_SENDER_TUNE, change: "any" }, (obj) => {
  const streamUrl = RADIO_STREAMS[obj.state.val];
  if (streamUrl) {
    setStateDelayed(ID_CC_URL, streamUrl, 500, false);
    console.log(`[Multimedia] Chromecast Stream geladen: ${obj.state.val}`);
  }
});
