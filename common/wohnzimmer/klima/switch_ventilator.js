let ventilator_timeout = null;

on(
  { id: "0_userdata.0.Entprellen.Kühlung.Ventilator", change: "ne" },
  async function (obj) {
    const targetState = obj.state ? obj.state.val : false;

    // 1. Laufende Verzögerungen für dieses Gerät löschen
    // Das verhindert, dass 5 Klicks zu 5 zeitversetzten Schaltvorgängen führen
    clearStateDelayed("tuya.0.bfc93beea92189ab17oopt.1");

    // 2. Den Befehl mit einer kurzen Verzögerung senden
    // Das 'true' am Ende löscht zusätzlich eventuelle andere Timer auf diesem Datenpunkt
    setStateDelayed("tuya.0.bfc93beea92189ab17oopt.1", targetState, 500, true);

    console.log(
      `Ventilator-Befehl ${targetState} vorgemerkt (500ms Entprellung aktiv)`,
    );
  },
);
