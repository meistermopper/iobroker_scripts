const IDS_POWER = [
  "sonoff.0.AVR-Steckdose.ENERGY_Power",
  "sonoff.0.Medienplayer-Steckdose.ENERGY_Power",
  "sonoff.0.TV-Steckdose.ENERGY_Power",
];

const ID_SUMME = "0_userdata.0.Energie.Summen.Wozi_Media";

on({ id: IDS_POWER, change: "ne" }, () => {
  let summe = 0;

  // Wir gehen alle IDs durch und addieren die Werte
  IDS_POWER.forEach((id) => {
    summe += getState(id).val || 0;
  });

  // Auf eine Nachkommastelle runden und schreiben
  setState(ID_SUMME, Math.round(summe * 10) / 10, true);
});
