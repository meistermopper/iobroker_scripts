var message = false;

schedule({ astro: 'goldenHour', shift: 0 }, async () => {
    // Min SoC auf 40, wenn der Speicher nicht voll wurde
    if (!message && ((new Date().getMonth() + 1) > 9 || (new Date().getMonth() + 1) < 3) && getState('modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)') && getState('modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)').val < 84 && getState('modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)') && getState('modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)').val < 40) {
        setState('modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)', 40);
        sendTo('telegram', 'send', {
            text: 'Schonung des Speichers im Winterhalbjahr: 🔋 Min SoC wurde auf 40 % festgelegt, weil der Speicher nicht vollgeladen wurde.\n\n Akkustand: ' + getState('modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)').val + ' %.'
        });
    }
});

schedule("59 0 * * *", async () => {
    message = false;
});

on({ id: 'modbus.0.inputRegisters.100.843_Battery_State_of_Charge_(System)', change: 'ne' }, async (obj) => {
    if (obj && obj.state && obj.oldState) {
        let value = obj.state.val;
        let oldValue = obj.oldState.val;
        // Speicher ist voll
        if (value === 96 && oldValue < 96 && !message) {
            sendTo('telegram', 'send', {
                text: '👌 Bingo! Die Hausbatterie ist aufgeladen.'
            });
            if (getState('0_userdata.0.gotifytoken.iobroker')) {
                exec('curl "https://mygotify.meistermopper.de/message?token=' + getState('0_userdata.0.gotifytoken.iobroker').val + '" -F "title=ioBroker:\n" -F "message=👌 Bingo! Die Hausbatterie ist proppevoll." -F "priority=1"', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        return;
                    }
                });
            }

            message = true;
            if (compareTime('08:00', '20:00', 'between')) {
                sendTo("sayit", "say", { text: 'Die Hausbatterie ist aufgeladen.' });
            }
            // MinSoC regeln (Sauna offen)
            if (getState('modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)') && getState('modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)').val > 20 && ((new Date().getMonth() + 1) > 9 || (new Date().getMonth() + 1) < 4)) {
                if (getState('modbus.0.inputRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)').val !== 30 && getState('zigbee.0.00158d0005435fe1.opened') && getState('zigbee.0.00158d0005435fe1.opened').val) {
                    setState('modbus.0.holdingRegisters.100.2901_ESS_Minimum_SoC_(unless_grid_fails)', 30);
                    sendTo('telegram', 'send', {
                        text: 'Winterhalbjahr: 🔋Min SoC wurde auf 30% festgelegt.'
                    });
                    if (getState('0_userdata.0.gotifytoken.iobroker')) {
                        exec('curl "https://mygotify.meistermopper.de/message?token=' + getState('0_userdata.0.gotifytoken.iobroker').val + '" -F "title=ioBroker:\n" -F "message=Winterhalbjahr: 🔋Min SoC wurde auf 30% festgelegt." -F "priority=1"', (error, stdout, stderr) => {
                            if (error) {
                                console.error(`exec error: ${error}`);
                                return;
                            }
                        });
                    }
                }
            }
        }
    }
});