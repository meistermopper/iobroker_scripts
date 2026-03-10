// --- KONFIGURATION ---
const strompreisDP = "0_userdata.0.Energie.Strompreise.akt_Preis";

// Hier kannst du weitere Geräte einfach hinzufügen:
// 'Verbrauchs-Datenpunkt': 'Kosten-Ziel-Datenpunkt'
const kostenMapping = {
  "0_userdata.0.Energie.R2Mäh2.Durchschnitt":
    "0_userdata.0.Energie.Kosten.R2Maeh2",
  // 'sonoff.0.Waschmaschine.ENERGY_Total': '0_userdata.0.Energie.Kosten.Waschmaschine'
};

// --- LOGIK ---

// Trigger für alle Verbrauchs-Datenpunkte
on({ id: Object.keys(kostenMapping), change: "ne" }, (obj) => {
  berechneKosten(obj.id, obj.state.val);
});

// Trigger bei Strompreis-Änderung (aktualisiert alle Kosten)
on({ id: strompreisDP, change: "ne" }, (obj) => {
  for (let verbrauchDP in kostenMapping) {
    berechneKosten(verbrauchDP, getState(verbrauchDP).val);
  }
});

function berechneKosten(verbrauchId, verbrauchWert) {
  const preis = getState(strompreisDP).val;
  const zielDP = kostenMapping[verbrauchId];

  if (typeof verbrauchWert === "number" && typeof preis === "number") {
    const kosten = Math.round(verbrauchWert * preis * 100) / 100;
    setState(zielDP, kosten, true);
  }
}
