/**
 * Name:   Miele-Adapter Neustart-Service
 * Zweck:  Startet die Instanz neu und prüft nach 10s den Verbindungsstatus
 */

const ID_RESTART_TRIGGER = '0_userdata.0.System.miele_restart';
const ID_ADAPTER_CONN = 'system.adapter.mielecloudservice.0.connected';
const ADAPTER_INSTANCE = 'mielecloudservice.0';

let mieleTimeout = null;

on({ id: ID_RESTART_TRIGGER, change: 'ne' }, async (obj) => {
    // Nur ausführen, wenn der Trigger auf "true" gesetzt wird
    if (!obj.state.val) return;

    try {
        // 1. Adapter neu starten
        await restartInstanceAsync(ADAPTER_INSTANCE);
        
        const startMsg = '⚙️ Der Miele-Adapter wurde neu gestartet.';
        sendTo('telegram', 'send', { text: startMsg });
        console.log(startMsg);

        // 2. Bestehenden Timer löschen, falls vorhanden
        if (mieleTimeout) clearTimeout(mieleTimeout);

        // 3. Status-Check nach 10 Sekunden
        mieleTimeout = setTimeout(async () => {
            const connected = (await getStateAsync(ID_ADAPTER_CONN)).val;
            
            const statusMsg = connected 
                ? '✅ Der Miele-Adapter ist wieder verbunden.' 
                : '⚠️ Der Miele-Adapter konnte keine Verbindung zum Server herstellen.';
            
            sendTo('telegram', 'send', { text: statusMsg });
            console.log(statusMsg);

            // Trigger wieder auf false setzen (bestätigt)
            setState(ID_RESTART_TRIGGER, false, true);
            mieleTimeout = null;
        }, 10000);

    } catch (err) {
        console.error(`Fehler beim Neustart des Miele-Adapters: ${err}`);
        sendTo('telegram', 'send', { text: `❌ Fehler beim Miele-Restart: ${err}` });
    }
});