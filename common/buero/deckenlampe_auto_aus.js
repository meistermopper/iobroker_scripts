/* eslint-env es2022 */
// --- KONFIGURATION ---
const ID_PC_POWER = "alias.0.buero.kiki_pc.ENERGY_Power";
const ID_LICHT = "alias.0.buero.licht.POWER";
const AUS_VERZOEGERUNG = 30 * 60 * 1000; // 30 Minuten in Millisekunden

let bueroTimer = null;

// --- LOGIK ---

on({ id: ID_PC_POWER, change: "ne" }, (obj) => {
  const aktuelleLeistung = obj.state.val;
  const lichtIstAn = getState(ID_LICHT)?.val;

  // BEDINGUNG: PC verbraucht wenig Strom (< 5W) UND das Licht brennt
  if (aktuelleLeistung < 5 && lichtIstAn) {
    // Timer nur starten, wenn nicht bereits einer läuft
    if (!bueroTimer) {
      console.log(`Büro-PC ist aus (${aktuelleLeistung}W). Licht schaltet in 30 Min. ab.`);

      bueroTimer = setTimeout(() => {
        // Sicherheitshalber nochmal prüfen, ob das Licht noch an ist
        if (getState(ID_LICHT)?.val) {
          setState(ID_LICHT, false);

          const msg = "💡 Das Licht im Büro wurde automatisch ausgeschaltet.";
          sendTo("telegram", "send", { text: msg });
          console.log(msg);
        }
        bueroTimer = null;
      }, AUS_VERZOEGERUNG);
    }
  }

  // ABBRUCH: PC wird wieder genutzt oder Licht ist bereits aus
  else {
    if (bueroTimer) {
      clearTimeout(bueroTimer);
      bueroTimer = null;
      console.log("Büro-Licht-Timer abgebrochen, da PC wieder aktiv oder Licht manuell aus.");
    }
  }
});
