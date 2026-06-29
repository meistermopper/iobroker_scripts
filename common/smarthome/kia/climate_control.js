// --- KONFIGURATION ---
const TARGET_TEMP = 21;
const TEMP_DEFROST = -3;
const TEMP_MAX_HEAT = 10;
const HOME_ADDRESS = "Stettiner Str. 4, 34613 Schwalmstadt, Germany";

const IDS = {
  airTemp: "bluelink.0.KNAFD81A7S6058382.control.clima.set.airTemp",
  defrost: "bluelink.0.KNAFD81A7S6058382.control.clima.set.defrost",
  climaStart: "bluelink.0.KNAFD81A7S6058382.control.clima.start",
  outerTemp: "alias.0.draussen.thermometer.ACTUAL_TEMPERATURE",
  location: "0_userdata.0.Energie.Kia_e_niro.Standort",
  isHome: "0_userdata.0.Heizen.Programme.Zuhause",
  holiday: "feiertage.0.heute.boolean",
  vacation1: "ical.1.events.0.today.ferien",
  vacation2: "ical.1.events.0.today.Ferien",
  klimaStatus: "0_userdata.0.Energie.Kia_e_niro.klima_status",
};

var timeoutDefrost;

// Hilfsfunktion: Prüft ob die aktuelle Kalenderwoche gerade ist
function istGeradeWoche() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const kw =
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return kw % 2 === 0;
}

// 1. ÜBERWACHUNG DER ZIELTEMPERATUR
on({ id: IDS.airTemp, change: "ne" }, async (obj) => {
  if (obj.state.val != TARGET_TEMP) {
    setState(IDS.airTemp, TARGET_TEMP);
  }
});

// 2. KLIMA-STATUS AKTUALISIEREN
on(
  {
    id: "bluelink.0.KNAFD81A7S6058382.vehicleStatusRaw.Green.PowerConsumption.Prediction.Climate",
    change: "ne",
  },
  async (obj) => {
    setState(IDS.klimaStatus, obj.state.val == 1, true);
  },
);

// 3. ZENTRALE FUNKTION FÜR DEN START
async function starteHeizung() {
  const aktuellTemp = getState(IDS.outerTemp)?.val;
  const amStandort = getState(IDS.location)?.val === HOME_ADDRESS;
  const heizenAktiv = getState(IDS.isHome)?.val;
  const keineArbeit =
    getState(IDS.holiday)?.val || getState(IDS.vacation1)?.val || getState(IDS.vacation2)?.val;

  if (heizenAktiv && amStandort && !keineArbeit) {
    // Logik: Entfrosten oder nur Heizen?
    if (aktuellTemp <= TEMP_DEFROST) {
      setState(IDS.defrost, true);
      setState(IDS.climaStart, true);
      sendTo("telegram", "send", {
        text: `+++ ♨️ ❄️ Kia: Entfrosten gestartet bei ${aktuellTemp} °C +++`,
      });
    } else if (aktuellTemp < TEMP_MAX_HEAT) {
      setState(IDS.climaStart, true);
      sendTo("telegram", "send", {
        text: `+++ ♨️ Kia: Heizen gestartet bei ${aktuellTemp} °C +++`,
      });
    }
  }
}

// --- ZEITPLÄNE ---

// Montag
schedule("40 9 * * 1", () => {
  starteHeizung();
});

// Dienstag
//schedule("0 8 * * 2", () => { starteHeizung(); });

// Mittwoch
schedule("0 8 * * 3", () => {
  starteHeizung();
});

// Donnerstag
//schedule("0 7 * * 4", () => { starteHeizung(); });

// FREITAG LOGIK
// 07:00 Uhr: Nur in ungeraden Wochen
schedule("0 7 * * 5", () => {
  if (!istGeradeWoche()) {
    console.log("Freitag (ungerade Woche): Starte Prüfung 07:00 Uhr");
    starteHeizung();
  }
});

// 08:00 Uhr: Nur in geraden Wochen
schedule("0 8 * * 5", () => {
  if (istGeradeWoche()) {
    console.log("Freitag (gerade Woche): Starte Prüfung 08:00 Uhr");
    starteHeizung();
  }
});
