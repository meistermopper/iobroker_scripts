// =============================================================================
// RPI-RAM MONITOR v2.0
// =============================================================================

const ID_MEM_AVAIL = 'rpi2.0.memory.memory_available';
const ID_MEM_TOTAL = 'rpi2.0.memory.memory_total';
const ID_RAM_USAGE = '0_userdata.0.ioBroker.RPI_Zigbee.rpi_ram_usage';

on({ id: ID_MEM_AVAIL, change: 'ne' }, (obj) => {
    const total = getState(ID_MEM_TOTAL).val;
    const avail = obj.state.val;

    if (total > 0) {
        // Berechnung: (Gesamt - Verfügbar) / Gesamt * 100
        const usedPercent = ((total - avail) / total) * 100;
        
        // Speichern mit 2 Nachkommastellen
        setState(ID_RAM_USAGE, Math.round(usedPercent * 100) / 100, true);
    }
});