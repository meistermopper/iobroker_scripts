/* eslint-env es2022 */
/**
 * Name:   TV Licht Schlafzimmer
 * Zweck:  Automatisches Schalten der Bett-Beleuchtung basierend auf TV-Receiver und Chromecast Status
 */

// --- KONFIGURATION ---
const ID_RECEIVER_STANDBY = "enigma2.1.enigma2.STANDBY";
const ID_CHROMECAST_PLAYING = "chromecast.0.CC-Schlazi.status.playing";
const ID_ZIGBEE_LICHT = "alias.0.schlafzimmer.energie.bett.state";

// --- LOGIK ---

/**
 * Checks receiver and Chromecast states, controlling the bed light accordingly.
 */
function updateBedLight() {
  const isReceiverActive = getState(ID_RECEIVER_STANDBY)?.val === false; // false = device turned on
  const isChromecastActive = getState(ID_CHROMECAST_PLAYING)?.val === true; // true = streaming active

  const isMediaActive = isReceiverActive || isChromecastActive;

  // Turn on light if at least one device is active and time is between sunset and 23:30
  if (isMediaActive && compareTime(getAstroDate("sunset"), "23:30", "between")) {
    setState(ID_ZIGBEE_LICHT, true);
  } else if (!isMediaActive) {
    // Turn off light if all media devices are inactive
    setState(ID_ZIGBEE_LICHT, false);
  }
}

// Trigger when either the receiver standby status or the Chromecast playing status changes
on({ id: [ID_RECEIVER_STANDBY, ID_CHROMECAST_PLAYING], change: "ne" }, () => {
  updateBedLight();
});
