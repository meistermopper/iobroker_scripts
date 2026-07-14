/* eslint-env es2022 */
// --- KONFIGURATION ---
const dpVerbrauchGestern = "alias.0.fitness.weinklimaschrank.ENERGY_Yesterday";
const dpStrompreis = "0_userdata.0.Energie.Strompreise.akt_Preis";
const dpKostenZiel = "0_userdata.0.Energie.Kosten.weinklima";

// --- LOGIK ---

// 1. Trigger: Update bei neuem Tageswert (nach Mitternacht)
on({ id: dpVerbrauchGestern, change: "ne" }, (obj) => {
  const verbrauch = obj.state.val;
  const preis = getState(dpStrompreis)?.val;

  if (typeof verbrauch === "number" && typeof preis === "number") {
    const kosten = Math.round(verbrauch * preis * 100) / 100;
    setState(dpKostenZiel, kosten, true);
    // console.log(`Weinklima Kosten gestern: ${kosten} €`);
  }
});

// 2. Trigger: Sofortige Neuberechnung bei Preisänderung
on({ id: dpStrompreis, change: "ne" }, (obj) => {
  const verbrauch = getState(dpVerbrauchGestern)?.val;
  const preis = obj.state.val;

  if (typeof verbrauch === "number" && typeof preis === "number") {
    const kosten = Math.round(verbrauch * preis * 100) / 100;
    setState(dpKostenZiel, kosten, true);
  }
});
