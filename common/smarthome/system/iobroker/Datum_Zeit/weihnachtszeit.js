/* eslint-env es2022 */
/**
 * Name:   Weihnachts-Modus-Manager
 * Zweck:  Automatisches Aktivieren/Deaktivieren der Weihnachtsbeleuchtung
 * Zeitraum: Start nach dem 7.12., Ende nach dem 6.1.
 */

const ID_MODUS = "0_userdata.0.Zeiten.Weihnachten";
const SCRIPTS_TO_TOGGLE = [
  "javascript.0.scriptEnabled.draussen.Weihnachtsbaum_Terrasse_js",
  "javascript.0.scriptEnabled.wohnzimmer.Beleuchtung.Baum_Zeitschalt_js",
];

schedule("1 0 * * *", () => {
  const jetzt = new Date();
  const tag = jetzt.getDate();
  const monat = jetzt.getMonth() + 1; // 1 = Januar, 12 = Dezember
  const datumString = `${tag}.${monat}.${jetzt.getFullYear()}`;

  const istAktiv = getState(ID_MODUS)?.val;

  // --- LOGIK: START (Dezember, nach dem 7.12.) ---
  if (monat === 12 && tag > 7 && !istAktiv) {
    setState(ID_MODUS, true);
    SCRIPTS_TO_TOGGLE.forEach((script) => {
      setState(script, true);
    });

    const msg = `+++ Der Weihnachtsmodus wurde gestartet +++\nEs ist der ${datumString}`;
    sendTo("telegram", "send", { text: msg, user: "Thomas" });
    console.warn(`Weihnachten: ${msg}`);
  }

  // --- LOGIK: ENDE (Januar, nach dem 6.1. / Heilige Drei Könige) ---
  else if (monat === 1 && tag > 6 && istAktiv) {
    setState(ID_MODUS, false);
    SCRIPTS_TO_TOGGLE.forEach((script) => {
      setState(script, false);
    });

    const msg = `+++ Der Weihnachtsmodus wurde beendet +++\nEs ist der ${datumString}`;
    sendTo("telegram", "send", { text: msg, user: "Thomas" });
    console.warn(`Weihnachten: ${msg}`);
  }
});
