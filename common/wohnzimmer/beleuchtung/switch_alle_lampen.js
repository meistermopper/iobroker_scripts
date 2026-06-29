let _wozilampe_timeout;

on({ id: "0_userdata.0.Licht.Wohnzimmer.alle_Lampen", change: "ne" }, async (obj) => {
  const val = obj.state.val;

  // Wir löschen alle eventuell noch laufenden Verzögerungen dieses Skripts sofort
  // um "Befehls-Salat" zu vermeiden
  clearStateDelayed("alias.0.wohnzimmer.licht.fernsehlicht.POWER");
  clearStateDelayed("alias.0.wohnzimmer.licht.Galaxie.POWER");
  clearStateDelayed("alias.0.wohnzimmer.licht.quader.on");
  clearStateDelayed("alias.0.wohnzimmer.licht.wozilampe.on");
  clearStateDelayed("alias.0.wohnzimmer.licht.spirale.on");

  if (val === true || val === 1 || val === "true") {
    console.log("Wohnzimmer: Schalte ALLES AN");

    // HUE Befehle
    setState("alias.0.wohnzimmer.licht.ei.on", true);
    setStateDelayed("alias.0.wohnzimmer.licht.ei.level", 100, 100, true);

    // --- HUE KOMMODE ---
    setStateDelayed("alias.0.wohnzimmer.licht.kommode.on", true, 200, true);
    setStateDelayed("alias.0.wohnzimmer.licht.kommode.level", 100, 300, true);

    // SONOFF Befehle (mit 'true' am Ende um alte Timer zu löschen)
    setStateDelayed("alias.0.wohnzimmer.licht.fernsehlicht.POWER", true, 200, true);
    setStateDelayed("alias.0.wohnzimmer.licht.Galaxie.POWER", true, 400, true); // Zeitabstand leicht erhöht
    setStateDelayed("alias.0.wohnzimmer.licht.quader.on", true, 600, true);
    setStateDelayed("alias.0.wohnzimmer.licht.wozilampe.on", true, 800, true);
    setStateDelayed("alias.0.wohnzimmer.licht.spirale.on", true, 1000, true);
    setStateDelayed("tuya.0.bfc93beea92189ab17oopt.9", true, 1200, true);
  } else {
    console.log("Wohnzimmer: Schalte ALLES AUS");

    // SONOFF Aus
    setState("alias.0.wohnzimmer.licht.fernsehlicht.POWER", false);
    setStateDelayed("alias.0.wohnzimmer.licht.Galaxie.POWER", false, 200, true);
    setStateDelayed("alias.0.wohnzimmer.licht.quader.on", false, 400, true);
    setStateDelayed("alias.0.wohnzimmer.licht.wozilampe.on", false, 600, true);
    setStateDelayed("alias.0.wohnzimmer.licht.spirale.on", false, 800, true);

    // HUE Aus
    // Hue getrennt ausschalten
    setStateDelayed("alias.0.wohnzimmer.licht.ei.on", false, 1000, true);
    setStateDelayed("alias.0.wohnzimmer.licht.kommode.on", false, 1100, true);
    setStateDelayed("tuya.0.bfc93beea92189ab17oopt.9", false, 1200, true);
  }
});
