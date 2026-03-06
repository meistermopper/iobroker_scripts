/**
 * Name:    Proxmox Cluster Master-Wächter
 * Version: 2.2 (Broadcast & Logic Deep-Dive)
 * Zweck:   Überwachung von Temperatur, Festplatten & Status.
 * Sendet Alarme an ALLE Telegram-User.
 */

// --- 1. KONFIGURATION ---
const GOTIFY_TOKEN_DP = '0_userdata.0.gotifytoken.iobroker';
const DP_SERVICE_MSG  = '0_userdata.0.Servicemeldungen.proxmox.proxmox_msg';

// Schwellenwerte
const TEMP_LIMIT    = 95;    // Alarm ab 95°C
const TEMP_HYST     = 5;     // Entwarnung erst bei < 90°C (Hysterese verhindert "Flattern")
const TEMP_DELAY    = 30000; // 30 Sekunden Puffer (ignoriert kurze Lastspitzen)
const DISK_LIMIT    = 85;    // Alarm bei 85% Festplattenbelegung
const OFFLINE_DELAY = 60000; // 1 Minute Puffer (ignoriert kurze Reconnects/Adapter-Restarts)

const SERVER_MAP = {
    'linux-control.0.Proxmox_pve1.CPUTemp': 'HA-PVE-01',
    'linux-control.0.Proxmox_pve2.CPUTemp': 'HA-PVE-02',
    'linux-control.0.Proxmox_pve3.CPUTemp': 'HA-PVE-03'
};

const NODE_STATUS_IDS = [
    'proxmox.0.node_HA-PVE-01.status',
    'proxmox.0.node_HA-PVE-02.status',
    'proxmox.0.node_HA-PVE-03.status'
];

// Speicher für Timer und Zustände (verhindert doppelte Meldungen)
let states = {
    temp: {}, 
    nodes: {},
    disks: {} 
};

// --- 2. HILFSFUNKTION (ZENTRALE MELDUNG) ---
/**
 * @param {string} title - Der Titel (wird fett gedruckt)
 * @param {string} msg - Der Nachrichtentext
 * @param {number} priority - Gotify Priorität (0-10)
 */
function notify(title, msg, priority = 5) {
    const token = getState(GOTIFY_TOKEN_DP).val;

    // 1. Telegram Broadcast
    // Durch Weglassen von 'user' wird die Nachricht an alle User gesendet.
    sendTo('telegram', 'send', { 
        text: `*${title}*\n${msg}`, 
        parse_mode: 'Markdown' 
    });
    
    // 2. Gotify (Modern via httpPost)
    if (token) {
        httpPost(`https://mygotify.meistermopper.de/message?token=${token}`, {
            title: title,
            message: msg,
            priority: priority
        }, (error) => {
            if (error) console.error(`[Master-Guard] Gotify Fehler: ${error}`);
        });
    }

    console.warn(`[Master-Guard] ${title}: ${msg}`);
}

// --- 3. ÜBERWACHUNGS-LOGIK ---

// A. TEMPERATUR (Anti-Spike & Hysterese)
on({ id: Object.keys(SERVER_MAP), change: 'ne' }, (obj) => {
    const geraet = SERVER_MAP[obj.id];
    const temp = parseFloat(obj.state.val);
    
    if (!states.temp[geraet]) states.temp[geraet] = { timer: null, alarm: false };
    const s = states.temp[geraet];

    // Wenn Limit überschritten: Timer starten (30s Puffer)
    if (temp >= TEMP_LIMIT && !s.alarm && !s.timer) {
        s.timer = setTimeout(() => {
            s.alarm = true;
            s.timer = null;
            notify('🔥 CPU Dauerhitze', `${geraet} ist seit 30s auf ${temp}°C!`, 9);
        }, TEMP_DELAY);
    } 
    // Wenn Temperatur sinkt, bevor der Timer abgelaufen ist: Timer löschen
    else if (temp < TEMP_LIMIT && s.timer) {
        clearTimeout(s.timer);
        s.timer = null;
    } 
    // Entwarnung erst, wenn Hysterese unterschritten wird (verhindert Alarm-Spam)
    else if (temp < (TEMP_LIMIT - TEMP_HYST) && s.alarm) {
        s.alarm = false;
        notify('❄️ Abkühlung', `${geraet} ist wieder im grünen Bereich (${temp}°C).`, 4);
    }
});

// B. DISK-LEVEL (Regex Überwachung)
// Diese Logik überwacht automatisch alle VMs und LXCs auf einmal.
on({ id: /^proxmox\.0\.(lxc|qemu)_.*\.disk_lev$/, change: 'ne' }, (obj) => {
    const level = obj.state.val;
    const oldLevel = obj.oldState ? obj.oldState.val : 0;

    // Nur melden, wenn der Schwellenwert NEU überschritten wurde
    if (level >= DISK_LIMIT && oldLevel < DISK_LIMIT) {
        const type = obj.id.includes('lxc') ? 'LXC' : 'VM';
        const name = obj.id.split('.')[2].replace('lxc_', '').replace('qemu_', '');
        notify('💾 Speicher-Warnung', `${type} "${name}" ist zu ${level}% belegt!`, 6);
    }
});

// C. NODE-STATUS (Offline-Puffer)
on({ id: NODE_STATUS_IDS, change: 'ne' }, (obj) => {
    const id = obj.id;
    const name = id.split('_')[1].replace('.status', '');
    
    if (!states.nodes[id]) states.nodes[id] = { timer: null, alarm: false };
    const s = states.nodes[id];

    if (obj.state.val === 'offline' && !s.timer) {
        // Puffer, falls der Proxmox-Adapter nur kurz neu startet
        s.timer = setTimeout(() => {
            if (getState(id).val === 'offline') {
                notify('❌ Node Offline', `${name} ist seit 1 Minute nicht erreichbar!`, 8);
                s.alarm = true;
            }
            s.timer = null;
        }, OFFLINE_DELAY);
    } else if (obj.state.val === 'online') {
        if (s.timer) { clearTimeout(s.timer); s.timer = null; }
        if (s.alarm) {
            notify('✅ Node Online', `${name} ist wieder stabil am Netz.`, 5);
            s.alarm = false;
        }
    }
});

// D. SERVICE-RELAIS
on({ id: DP_SERVICE_MSG, change: 'ne' }, (obj) => {
    const msg = obj.state.val;
    if (msg && msg !== 'deleted' && msg !== '') {
        notify('🖥️ Proxmox Service', msg, 2);
        // Automatisches "Aufräumen" des Datenpunkts
        setStateDelayed(DP_SERVICE_MSG, 'deleted', true, 1000, false);
    }
});