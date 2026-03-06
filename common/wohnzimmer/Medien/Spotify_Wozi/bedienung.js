// =============================================================================
// SPOTIFY-CONTROL v2.0 (DEBOUNCED CHROMECAST FORWARDING)
// =============================================================================

// --- 1. KONFIGURATION (Trigger-Datenpunkt : Ziel-Datenpunkt) ---
const PLAYER_MAP = {
    '0_userdata.0.Entprellen.Medien.Player.Wohnzimmer.Spotify.next':  'chromecast.0.cc_wozi.player.next',
    '0_userdata.0.Entprellen.Medien.Player.Wohnzimmer.Spotify.pause': 'chromecast.0.cc_wozi.player.pause',
    '0_userdata.0.Entprellen.Medien.Player.Wohnzimmer.Spotify.play':  'chromecast.0.cc_wozi.player.play',
    '0_userdata.0.Entprellen.Medien.Player.Wohnzimmer.Spotify.prev':  'chromecast.0.cc_wozi.player.prev'
};

let isBlocked = false; // Die Triggersperre

// --- 2. LOGIK ---

// Wir triggern auf alle IDs, die im PLAYER_MAP Objekt als Keys definiert sind
on({ id: Object.keys(PLAYER_MAP), change: 'ne', val: true }, (obj) => {
    
    // Falls die Sperre aktiv ist: Abbruch
    if (isBlocked) return;

    // Ziel-ID aus der Map holen (basierend auf der ID, die ausgelöst hat)
    const targetId = PLAYER_MAP[obj.id];

    if (targetId) {
        // Befehl an Chromecast senden
        setState(targetId, true);
        
        // Sperre aktivieren
        isBlocked = true;
        
        // Sperre nach 100ms wieder aufheben
        setTimeout(() => {
            isBlocked = false;
        }, 100);

        console.log(`[Spotify] Befehl ${obj.id.split('.').pop()} an Chromecast weitergeleitet.`);
    }
});