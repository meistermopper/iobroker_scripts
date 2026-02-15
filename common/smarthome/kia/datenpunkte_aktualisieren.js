// --- KONFIGURATION ---
const vin = 'bluelink.0.KNAFD81A7S6058382';
const userDataPath = '0_userdata.0.Energie.Kia_e_niro';

// Liste der überwachten Control-Datenpunkte
const controlIDs = [
    `${vin}.control.charge`,
    `${vin}.control.charge_stop`,
    `${vin}.control.clima.start`,
    `${vin}.control.clima.stop`,
    `${vin}.control.lock`,
    `${vin}.control.unlock`
];

// --- LOGIK ---
on({ id: controlIDs, change: 'any' }, (obj) => {
    const id = obj.id;
    const val = obj.state.val;

    // Nur reagieren, wenn der Button/Datenpunkt getriggert wurde (meist true)
    if (!val) return; 

    if (id.includes('control.charge')) {
        setState(`${userDataPath}.charge`, true);
    } 
    else if (id.includes('control.charge_stop')) {
        setState(`${userDataPath}.charge`, false);
    } 
    else if (id.includes('control.clima.start')) {
        setState(`${userDataPath}.airCtrlOn`, true);
        setState(`${userDataPath}.klima_status`, true);
    } 
    else if (id.includes('control.clima.stop')) {
        setState(`${userDataPath}.airCtrlOn`, false);
        setState(`${userDataPath}.klima_status`, false);
    } 
    else if (id.includes('control.lock')) {
        setState(`${userDataPath}.doorlock`, true);
        console.log('Kia: Fahrzeug verriegelt');
    } 
    else if (id.includes('control.unlock')) {
        setState(`${userDataPath}.doorlock`, false);
        console.log('Kia: Fahrzeug entriegelt');
    }
});