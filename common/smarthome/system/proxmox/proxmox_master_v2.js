/**
 * Name:   Proxmox Cluster Master-Wächter
 * Version: 2.0 (Full Integration)
 * Zweck:  Überwacht Temperatur, Festplatten, Node-Status & Service-Relais
 */

// --- KONFIGURATION ---
const GOTIFY_TOKEN = getState('0_userdata.0.gotifytoken.iobroker').val;
const TELEGRAM_USER = 'Thomas';
const DP_SERVICE_MSG = '0_userdata.0.Servicemeldungen.proxmox.proxmox_msg';

// Schwellenwerte
const TEMP_LIMIT = 95;       // °C
const TEMP_HYST  = 5;        // Hysterese für Entwarnung
const TEMP_DELAY = 30000;    // 30s Verzögerung gegen Spitzen
const DISK_LIMIT = 85;       // %
const OFFLINE_DELAY = 60000; // 1 Minute Puffer für Node-Offline

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

// Speicher für Timer und Zustände
let states = {
    temp: {},   // { 'linux-control...': { timer: null, alarm: false } }
    nodes: {},  // { 'proxmox.0...': { timer: null, alarm: false } }
    disks: {}   // Speicherplatz-Status
};

// --- HILFSFUNKTION (ZENTRALE MELDUNG) ---
function notify(title, msg, priority = 5) {
    // 1. Telegram
    sendTo('telegram', 'send', { user: TELEGRAM_USER, text: `${title}:\n${msg}` });
    
    // 2. Gotify (Modern via httpPost)
    httpPost(`https://mygotify.meistermopper.de/message?token=${GOTIFY_TOKEN}`, {
        title: title,
        message: msg,
        priority: priority
    }, (error) => {
        if (error) console.error(`[Master-Guard] Gotify Fehler: ${error}`);
    });

    console.warn(`[Master-Guard] ${title}: ${msg}`);
}

// --- 1. LOGIK: TEMPERATUR (NUCs mit Anti-Spike) ---
on({ id: Object.keys(SERVER_MAP), change: 'ne' }, (obj) => {
    const geraet = SERVER_MAP[obj.id];
    const temp = parseFloat(obj.state.val);
    if (!states.temp[geraet]) states.temp[geraet] = { timer: null, alarm: false };
    const s = states.temp[geraet];

    if (temp >= TEMP_LIMIT && !s.alarm && !s.timer) {
        s.timer = setTimeout(() => {
            s.alarm = true;
            s.timer = null;
            notify('🔥 CPU Dauerhitze', `${geraet} ist seit 30s auf ${temp}°C!`, 9);
        }, TEMP_DELAY);
    } else if (temp < TEMP_LIMIT && s.timer) {
        clearTimeout(s.timer);
        s.timer = null;
    } else if (temp < (TEMP_LIMIT - TEMP_HYST) && s.alarm) {
        s.alarm = false;
        console.log(`[Master-Guard] Abkühlung: ${geraet} wieder im grünen Bereich.`);
    }
});

// --- 2. LOGIK: SPEICHERPLATZ (VM / LXC) ---
on({ id: /^proxmox\.0\.(lxc|qemu)_.*\.disk_lev$/, change: 'ne' }, (obj) => {
    const level = obj.state.val;
    const oldLevel = obj.oldState ? obj.oldState.val : 0;

    if (level >= DISK_LIMIT && oldLevel < DISK_LIMIT) {
        const type = obj.id.includes('lxc') ? 'LXC' : 'VM';
        const name = obj.id.split('.')[2].replace('lxc_', '').replace('qemu_', '');
        notify('💾 Speicher-Warnung', `${type} "${name}" ist zu ${level}% belegt!`, 6);
    }
});

// --- 3. LOGIK: NODE-STATUS (Offline/Online mit Puffer) ---
on({ id: NODE_STATUS_IDS, change: 'ne' }, (obj) => {
    const id = obj.id;
    const name = obj.channelName || id.split('_')[1].replace('.status', '');
    if (!states.nodes[id]) states.nodes[id] = { timer: null, alarm: false };
    const s = states.nodes[id];

    if (obj.state.val === 'offline' && !s.timer) {
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

// --- 4. LOGIK: SERVICE-RELAIS (Empfang von anderen Systemen) ---
on({ id: DP_SERVICE_MSG, change: 'ne' }, (obj) => {
    const msg = obj.state.val;
    if (msg && msg !== 'deleted') {
        notify('🖥️ Proxmox Service', msg, 1);
        // Zurücksetzen mit kleiner Verzögerung
        setStateDelayed(DP_SERVICE_MSG, 'deleted', true, 500, false);
    }
});