// --- KONFIGURATION ---
const saunaPlayerID = "alias.0.sauna.media.heos";
const saunaSenderDP = "0_userdata.0.heos.Sauna.sender";
const saunaStatusDP = "0_userdata.0.heos.Sauna.radio_status";
const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker").val;
const saunaVolume = 10;

const saunaMap = {
  jazzgroove: { preset: 1, name: "The Jazz Groove" },
  jazzradio: { preset: 2, name: "Jazz Radio" },
  smoothjazz: { preset: 3, name: "Smoothjazz" },
  hr1: { preset: 4, name: "HR 1" },
  hrinfo: { preset: 5, name: "hr info" },
  swissjazz: { preset: 6, name: "Swiss Jazz" },
  mdrkultur: { preset: 7, name: "MDR Kultur" },
  hr3: { preset: 8, name: "HR 3" },
  ffh: { preset: 9, name: "FFH" },
};

// Hilfsfunktion für Benachrichtigungen
function notify(msg) {
  sendTo("telegram", "send", { text: msg });
  console.log("Notification: " + msg);
  exec(
    `curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker" -F "message=${msg}" -F "priority=1"`,
  );
}

// --- LOGIK ---

// 1. Trigger: Statusänderung (Play/Stop)
on({ id: saunaStatusDP, change: "ne" }, (obj) => {
  const isPlaying = !!obj.state.val;
  setState(`${saunaPlayerID}.state`, isPlaying ? "play" : "stop");

  if (!isPlaying) {
    notify("+++ 📻 ⏹️ Radio in der Sauna wurde ausgeschaltet +++");
  }
});

// 2. Trigger: Senderwahl
on({ id: saunaSenderDP, change: "any" }, (obj) => {
  const sender = saunaMap[obj.state.val];

  if (sender) {
    const cmd = `set_volume&level=${saunaVolume}|play_preset&preset=${sender.preset}`;

    // Manche Presets brauchen laut deinem Original 8 Sek. Delay, hier einheitlich:
    setStateDelayed(`${saunaPlayerID}.command`, cmd, 100, false);
    setStateDelayed(saunaStatusDP, true, 1000, false);

    notify(`+++ 📻 ▶️Radio in der Sauna läuft (${sender.name}) +++`);
  } else {
    console.warn(`Sauna: Sender ${obj.state.val} unbekannt.`);
  }
});
