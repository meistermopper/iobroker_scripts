/* eslint-env es2022 */
/**
 * Name:   Energie-Tagesabrechnung
 * Zweck:  Berechnet täglich die Kosten pro Gerät und die Gesamtsumme
 */

// 1. KONFIGURATION: Hier einfach neue Geräte hinzufügen
const GERAETE_CONFIG = [
  { name: "AVR", sonoff: "AVR-Steckdose" },
  { name: "Backofen", sonoff: "Backofen" },
  { name: "Boiler", sonoff: "Boiler" },
  { name: "Gefrier", sonoff: "Gefrierschrank" },
  { name: "Geschirr", sonoff: "Geschirrspueler" },
  { name: "Kiki_PC", sonoff: "Kiki-PC-Steckdose" },
  { name: "Schlazi_Medien", sonoff: "Schlazi-Steckdose" },
  { name: "Trocknen", sonoff: "Trockner" },
  { name: "Waschen", sonoff: "Waschmaschine" },
  { name: "R2Maeh2", sonoff: "R2Maeh2-Steckdose" },
];

const PATH_COSTS = "0_userdata.0.Energie.Strompreise.";
const PATH_PRICE = "0_userdata.0.Energie.Strompreise.akt_Preis";

// 2. TÄGLICHE EINZELABRECHNUNG (23:59 Uhr)
schedule("59 23 * * *", () => {
  const preis = getState(PATH_PRICE)?.val || 0.3;

  GERAETE_CONFIG.forEach((geraet, index) => {
    const kwhHeute = getState(`sonoff.0.${geraet.sonoff}.ENERGY_Today`)?.val || 0;
    const kosten = parseFloat((kwhHeute * preis).toFixed(2));

    // Versetztes Schreiben, um die Last zu verteilen (wie in deinem Original)
    setStateDelayed(`${PATH_COSTS}${geraet.name}_heute`, kosten, index * 100, false);
  });

  //console.log(`Energie: Einzelkosten für ${GERAETE_CONFIG.length} Geräte berechnet.`);
});

// 3. GESAMTSUMME BERECHNEN (00:05 Uhr)
schedule("5 0 * * *", () => {
  let gesamtSumme = 0;

  GERAETE_CONFIG.forEach((geraet) => {
    // Wir nehmen die Werte, die wir um 23:59 Uhr geschrieben haben
    const wert = getState(`${PATH_COSTS}${geraet.name}_heute`)?.val || 0;
    gesamtSumme += wert;
  });

  setState(`${PATH_COSTS}Tag_gesamt`, parseFloat(gesamtSumme.toFixed(2)), true);
  //console.log(`Energie: Tages-Gesamtkosten berechnet: ${gesamtSumme.toFixed(2)} €`);
});
