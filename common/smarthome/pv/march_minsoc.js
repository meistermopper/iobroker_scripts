schedule("1 0 1 3 *", function () {
  const aktuellerWert = getState(
    "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
  )?.val;

  if (aktuellerWert !== 30) {
    setState(
      "modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)",
      30,
      true,
    );
    console.log("MinSoc der Batterie wurde auf 30% gesetzt.");
  } else {
    console.log("MinSoc der Batterie war bereits auf 30% gesetzt.");
  }
});
