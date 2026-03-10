// --- KONFIGURATION ---
const dpVerbrauchGestern = "alias.0.vorkeller.serverschrank.ENERGY_Yesterday";
const dpStrompreis = "0_userdata.0.Energie.Strompreise.akt_Preis";
const dpKostenZiel = "0_userdata.0.Energie.Kosten.Serverschrank";

// --- LOGIK ---

// 1. Trigger: Sobald Sonoff den Wert für "Gestern" aktualisiert (meist kurz nach Mitternacht)
on({ id: dpVerbrauchGestern, change: "ne" }, (obj) => {
  berechneITKosten(obj.state.val);
});

// 2. Trigger: Falls sich der Strompreis ändert, Kosten sofort neu berechnen
on({ id: dpStrompreis, change: "ne" }, () => {
  berechneITKosten(getState(dpVerbrauchGestern).val);
});

function berechneITKosten(verbrauch) {
  const preis = getState(dpStrompreis).val;

  if (typeof verbrauch === "number" && typeof preis === "number") {
    // Berechnung: kWh * Preis (auf 2 Dezimalstellen gerundet)
    const kosten = Math.round(verbrauch * preis * 100) / 100;

    setState(dpKostenZiel, kosten, true);
    //console.log(`Serverschrank Kosten gestern: ${kosten} € (${verbrauch} kWh)`);
  }
}
