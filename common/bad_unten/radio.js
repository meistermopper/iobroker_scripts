/* eslint-env es2022 */
// =============================================================================
// RADIO BAD MASTER-STEUERUNG v2.0 (SAUNA-SAFE & REFACTORED)
// =============================================================================

// --- KONFIGURATION ---
const VOL_NORMAL = 25; // Lautstärke bei manuellem Einschalten
const VOL_SAUNA = 15; // Lautstärke während des Sauna-Betriebs

const SENDER_CONFIG = {
  hr1: { preset: 4, name: "HR 1" },
  jazzgroove: { preset: 1, name: "The Jazz Groove" },
  jazzradio: { preset: 2, name: "Jazz Radio" },
  smoothjazz: { preset: 3, name: "Smoothjazz" },
  hrinfo: { preset: 5, name: "hr info" },
  swissjazz: { preset: 6, name: "Swiss Jazz" },
  mdrkultur: { preset: 7, name: "MDR Kultur" },
  ffh: { preset: 9, name: "FFH" },
  jazzloft: { preset: 10, name: "Jazz Loft" },
};

const IDS = {
  hueOn: "alias.0.bad_unten.schalter.on",
  hueOff: "alias.0.bad_unten.schalter.off",
  hueUp: "alias.0.bad_unten.schalter.brightness_move_up",
  hueDown: "alias.0.bad_unten.schalter.brightness_move_down",
  hueStop: "alias.0.bad_unten.schalter.brightness_stop",
  bwm: "alias.0.bad_unten.bwm.occupancy",
  denonVol: "denon.0.zone2.volume",
  denonPower: "denon.0.zone2.powerZone",
  heosState: "alias.0.bad_unten.media.heos.state",
  heosCmd: "alias.0.bad_unten.media.heos.command",
  userSender: "0_userdata.0.heos.Bad.sender",
  userStatus: "0_userdata.0.heos.Bad.radio_status",
  saunaAktiv: "0_userdata.0.Haushalt.sauna_laeuft", // WICHTIG: Verbindung zum Master
};

let timeoutAusschalten = null;
let volInterval = null;

function stopAllTimers() {
  if (timeoutAusschalten) {
    clearTimeout(timeoutAusschalten);
    timeoutAusschalten = null;
  }
  if (volInterval) {
    clearInterval(volInterval);
    volInterval = null;
  }
}

function changeVolume(step) {
  const currentVol = getState(IDS.denonVol)?.val;
  const newVol = Math.min(100, Math.max(0, currentVol + step));
  setState(IDS.denonVol, newVol);
}

// --- TRIGGER ---

// 1. NACHTRUHE (Nur wenn Sauna NICHT läuft)
schedule("0 21 * * *", () => {
  const saunaLaeuft = getState(IDS.saunaAktiv)?.val;
  if (saunaLaeuft) return; // Sauna hat Vorrang!

  if (getState(IDS.userStatus)?.val) {
    if (!getState(IDS.bwm)?.val) {
      setState(IDS.userStatus, false); // Radio ausschalten
      sendGlobalNotify("🌙 Nachtruhe: Bad leer, Radio aus.", "Radio Bad", 1);
    } else {
      // Warten bis Bad verlassen wird
      const stopSub = on({ id: IDS.bwm, val: false }, () => {
        if (!getState(IDS.saunaAktiv)?.val) {
          setState(IDS.userStatus, false); // Radio ausschalten
          sendGlobalNotify("🌙 Nachtruhe: Bad jetzt leer, Radio aus.", "Radio Bad", 1);
        }
        unsubscribe(stopSub);
      });
    }
  }
});

// 2. EINSCHALTEN (Hue On)
on({ id: IDS.hueOn, change: "gt" }, () => {
  setState(IDS.userSender, "hr1");
  stopAllTimers();

  // Auto-Off Timer (Nur wenn Sauna NICHT läuft)
  timeoutAusschalten = setTimeout(() => {
    if (getState(IDS.userStatus)?.val && !getState(IDS.saunaAktiv)?.val) {
      setState(IDS.userStatus, false); // Radio ausschalten
      sendGlobalNotify("📻 Auto-Off (30 Min)", "Radio Bad", 1);
    }
  }, 1800000);
});

// 3. AUSSCHALTEN (Hue Off)
on({ id: IDS.hueOff, change: "gt" }, () => {
  setState(IDS.userStatus, false);
});

// 4. LAUTSTÄRKE (Hue Dimming)
on({ id: IDS.hueUp, change: "gt" }, () => {
  if (volInterval) clearInterval(volInterval);
  volInterval = setInterval(() => changeVolume(2), 250);
});
on({ id: IDS.hueDown, change: "gt" }, () => {
  if (volInterval) clearInterval(volInterval);
  volInterval = setInterval(() => changeVolume(-2), 250);
});
on({ id: IDS.hueStop, change: "gt" }, () => {
  if (volInterval) {
    clearInterval(volInterval);
    volInterval = null;
  }
});

// 5. PLAY/STOP LOGIK
on({ id: IDS.userStatus, change: "ne" }, (obj) => {
  if (obj.state.val) {
    setState(IDS.heosState, "play");
  } else {
    setState(IDS.heosState, "stop");
    setState(IDS.denonPower, false);
    stopAllTimers();
  }
});

// 6. SENDER-UMSCHALTER
on({ id: IDS.userSender, change: "any" }, (obj) => {
  const sender = SENDER_CONFIG[obj.state.val];
  if (sender) {
    const saunaLaeuft = getState(IDS.saunaAktiv)?.val;
    const targetVol = saunaLaeuft ? VOL_SAUNA : VOL_NORMAL;

    const isPowered = getState(IDS.denonPower)?.val;
    const delay = isPowered ? 0 : 8000;

    if (!isPowered) setState(IDS.denonPower, true);

    const cmd = `set_volume&level=${targetVol}|play_preset&preset=${sender.preset}`;
    if (delay > 0) {
      setStateDelayed(IDS.heosCmd, cmd, delay, false);
    } else {
      setState(IDS.heosCmd, cmd);
    }

    setStateDelayed(IDS.userStatus, true, 1000, false);
    sendGlobalNotify(`▶️ ${sender.name} läuft.`, "Radio Bad", 1);
  }
});
