// --- KONFIGURATION ---
const people = [
    { name: 'Thomas', mac: 'dc:e5:5b:11:b8:7e', delay: 120000 }, // 2 Minuten Puffer
    { name: 'Kiki',   mac: '78:53:64:01:8b:04', delay: 120000 }
];

const basePath = '0_userdata.0.Unifi.Anwesenheit';
const gotifyTokenDP = '0_userdata.0.gotifytoken.iobroker';
const telegramUser = 'Thomas';

// --- INITIALISIERUNG ---
async function init() {
    for (const person of people) {
        await createStateAsync(`${basePath}.${person.name}_IsOnline`, { name: `${person.name} Status`, type: 'boolean', role: 'indicator.connected', def: false });
        await createStateAsync(`${basePath}.${person.name}`, { name: `${person.name} Text`, type: 'string', role: 'text', def: 'noch leer' });
        
        setupPresenceLogic(person);
    }
}

// --- LOGIK ---
function setupPresenceLogic(person) {
    const triggerId = `unifi-network.0.clients.users.${person.mac}.isOnline`;
    let offlineTimer = null;

    on({ id: triggerId, change: 'ne' }, (obj) => {
        const currentlyOnline = !!obj.state.val;
        const lastStatus = getState(`${basePath}.${person.name}_IsOnline`).val;

        if (currentlyOnline) {
            // Gerät ist wieder da
            if (offlineTimer) {
                clearTimeout(offlineTimer);
                offlineTimer = null;
            }
            // Nur benachrichtigen, wenn wir vorher wirklich als "Offline" markiert waren
            if (lastStatus === false) {
                updateStatus(person, true);
            }
        } else {
            // Gerät geht offline -> Erst nach Ablauf des Timers wirklich offline setzen
            if (!offlineTimer) {
                offlineTimer = setTimeout(() => {
                    updateStatus(person, false);
                    offlineTimer = null;
                }, person.delay);
            }
        }
    });
}

// --- STATUS UPDATE & NOTIFY ---
function updateStatus(person, isOnline) {
    const statusId = `${basePath}.${person.name}_IsOnline`;
    const textId = `${basePath}.${person.name}`;
    const text = `Das Smartphone von ${person.name} ist ${isOnline ? 'online ✅' : 'offline ❌'}`;

    setState(statusId, isOnline, true);
    setState(textId, text, true);

    // Telegram & Gotify
    sendTo('telegram.0', { user: telegramUser, text: text });
    
    const token = getState(gotifyTokenDP).val;
    if (token) {
        exec(`curl "https://mygotify.meistermopper.de/message?token=${token}" -F "title=ioBroker" -F "message=${text}" -F "priority=1"`);
    }
}

init();