schedule("1 0 1 3 *", function () {
  const aktuellerWert = getState(
    "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)"
  ).val;

  if (aktuellerWert !== 20) {
    setState(
      "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
      20,
      true
    );
    console.log(
      "MinSoc der Batterie wurde auf 20% gesetzt."
    );
  } else {
    console.log(
      "MinSoc der Batterie war bereits auf 20% gesetzt."
    );
  }
});