// --- Konfiguration ---
const ID_TEMP_KACHELOFEN = "alias.0.wohnzimmer.klima.kachelofen.temperature";
const ID_TEMP_WOHNZIMMER = "alias.0.wohnzimmer.heizung.ACTUAL_TEMPERATURE";
const ID_FAN_SWITCH = "alias.0.wohnzimmer.klima.ventilator.1";
const ID_FAN_SPEED = "alias.0.wohnzimmer.klima.ventilator.3";
const ID_FAN_ONLINE = "alias.0.wohnzimmer.klima.ventilator.online";
const ID_HEIZPERIODE = "0_userdata.0.Energie.heizperiode";
const ID_GOTIFY_TOKEN = "0_userdata.0.gotifytoken.iobroker";

let einschaltenAktiv = false;

// Hilfsfunktion für Benachrichtigungen (Telegram & Gotify)
function notify(msg) {
  // Telegram
  sendTo("telegram", "send", { text: msg, user: "Thomas" });

  // Gotify
  const token = getState(ID_GOTIFY_TOKEN)?.val;
  if (token) {
    httpPost(`https://mygotify.meistermopper.de/message?token=${token}`, {
      title: "ioBroker Fan",
      message: msg,
      priority: 1
    }, (error) => {
      if (error) console.error(`[Kachelofen Ventilator] Gotify Fehler: ${error}`);
    });
  }

  //console.log("Meldung gesendet: " + msg);
}

// Hilfsfunktion zum Einschalten
function turnFanOn(reason) {
  if (getState(ID_FAN_ONLINE)?.val) {
    setState(ID_FAN_SWITCH, true);
    setStateDelayed(ID_FAN_SPEED, 0, 1000, false);
    einschaltenAktiv = true;
    notify(`𖣘 Der Ventilator wurde eingeschaltet. ${reason}`);
  } else {
    einschaltenAktiv = true; // Merken für später
    notify(`𖣘 Ventilator offline! Wird eingeschaltet sobald online. ${reason}`);
  }
}

// --- Trigger: Temperatur am Kachelofen ---
on({ id: ID_TEMP_KACHELOFEN, change: "ne" }, (obj) => {
  const temp = obj.state.val;
  const oldTemp = obj.oldState.val;
  const month = new Date().getMonth() + 1;
  const isHeizmonat = month < 5 || month >= 9;

  // LOGIK 1: Kachelofen (Winter/Übergangszeit)
  if (
    isHeizmonat &&
    temp >= 23 &&
    oldTemp < 23 &&
    !getState(ID_FAN_SWITCH)?.val &&
    !einschaltenAktiv
  ) {
    turnFanOn(`Temperatur am Kachelofen: ${temp}°C.`);
  }

  // LOGIK 2: Sommer-Modus (Wohnzimmer Temp)
  if (
    !isHeizmonat &&
    temp >= 25 &&
    oldTemp < 25 &&
    !getState(ID_FAN_SWITCH)?.val &&
    !einschaltenAktiv
  ) {
    const tempWZ = getState(ID_TEMP_WOHNZIMMER)?.val;
    turnFanOn(`Temperatur im Wohnzimmer: ${tempWZ}°C.`);
  }
});

// --- Trigger: Wieder Online kommen ---
on({ id: ID_FAN_ONLINE, change: "gt" }, (obj) => {
  if (obj.state.val && einschaltenAktiv && !getState(ID_FAN_SWITCH)?.val) {
    turnFanOn("nachdem er wieder online war.");
  }
});

// --- Schedule: Nachts zurücksetzen ---
schedule("2 0 * * *", () => {
  einschaltenAktiv = false;
  const month = new Date().getMonth() + 1;
  const heizperiode = month < 5 || month >= 9;
  setState(ID_HEIZPERIODE, heizperiode, true);
});
