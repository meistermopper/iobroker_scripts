/**
 * Name:   Homematic Service-Zentrale (FIXED)
 * Zweck:  Überwacht UNREACH, LOWBAT, CONFIG_PENDING und CCU-Firmware
 */

const PATH = '0_userdata.0.HM-Servicemeldungen';
const ID_LOCAL_FW = 'hm-rega.0.PEQ1947872.0.FIRMWARE_VERSION';
const ID_ONLINE_FW = '0_userdata.0.ccu.Verfuegbare_CCU-Firmware';

// Selektoren für die Hardware-Meldungen
const SelectorUNREACH = $('channel[state.id=*.UNREACH]');
const SelectorLOWBAT = $('channel[state.id=*.LOWBAT]');
const SelectorCONFIG = $('channel[state.id=*.CONFIG_PENDING]');

// 1. Initialisierung der Datenpunkte (Korrektur: extendObject statt setObjectNotExistsAsync)
function init() {
    const states = [
        ['Anzahl', 'number', 'Anzahl Servicemeldungen', ''],
        ['Text', 'string', 'Servicemeldungen Text', ''],
        ['Firmware_Update', 'boolean', 'CCU Firmware Update verfügbar', '']
    ];

    states.forEach(([id, type, name, unit]) => {
        extendObject(`${PATH}.${id}`, {
            type: 'state',
            common: {
                name: name,
                type: type,
                role: type === 'boolean' ? 'indicator.maintenance' : 'value',
                read: true,
                write: false,
                unit: unit
            },
            native: {}
        });
    });
}

function checkHomematicService() {
    let anzahl = 0;
    let textList = [];

    // --- TEIL 1: Hardware-Meldungen scannen ---
    function processSelector(selector) {
        selector.each(id => {
            if (existsState(id) && getState(id).val === true) {
                const obj = getObject(id);
                const deviceName = (obj && obj.common && obj.common.name) ? obj.common.name : id;
                const type = id.split('.').pop();
                textList.push(`⚠️ <b>${deviceName}</b>: ${type}`);
                anzahl++;
            }
        });
    }

    processSelector(SelectorUNREACH);
    processSelector(SelectorLOWBAT);
    processSelector(SelectorCONFIG);

    // --- TEIL 2: CCU-Firmware Vergleich ---
    const stateLocal = getState(ID_LOCAL_FW);
    const stateOnline = getState(ID_ONLINE_FW);
    let fwUpdate = false;

    if (stateLocal && stateOnline && stateLocal.val && stateOnline.val) {
        if (stateLocal.val < stateOnline.val) {
            fwUpdate = true;
            textList.push(`🆕 <b>CCU Firmware</b>: Update verfügbar (${stateLocal.val} ➔ ${stateOnline.val})`);
            anzahl++;
        }
    }

    // --- TEIL 3: Ergebnisse schreiben ---
    setState(`${PATH}.Firmware_Update`, fwUpdate, true);
    setState(`${PATH}.Anzahl`, anzahl, true);

    const finalBuffer = anzahl > 0 ? textList.join('<br>') : "keine Service-Meldungen vorhanden";
    setState(`${PATH}.Text`, finalBuffer, true);

    //if (anzahl > 0) console.log(`HM-Service: ${anzahl} Meldungen aktiv.`);
}

// --- TRIGGER ---
SelectorUNREACH.on(checkHomematicService);
SelectorLOWBAT.on(checkHomematicService);
SelectorCONFIG.on(checkHomematicService);
on({ id: [ID_LOCAL_FW, ID_ONLINE_FW], change: 'ne' }, checkHomematicService);

// Backup-Check alle 30 Minuten
schedule("*/30 * * * *", checkHomematicService);

// Start-Sequenz
init();
setTimeout(checkHomematicService, 1000); // 1 Sekunde Verzögerung nach Start

// --- TELEGRAM BENACHRICHTIGUNG ---
on({ id: `${PATH}.Anzahl`, change: 'gt' }, (obj) => {
    const text = getState(`${PATH}.Text`).val;
    const anzahl = obj.state.val;

    const msg = `⚠️ <b>Homematic Servicemeldung</b>\n\nAktuelle Meldungen (${anzahl}):\n${text.replace(/<br>/g, '\n')}`;

    sendTo('telegram', 'send', {
        text: msg,
        parse_mode: 'HTML'
    });

    // Optional: Auch an Gotify senden
    const token = getState('0_userdata.0.gotifytoken.iobroker').val;
    if (token) {
        const url = `https://mygotify.meistermopper.de/message?token=${token}`;
        const payload = {
            title: "HM Service",
            message: msg.replace(/<[^>]*>/g, ''),
            priority: 1
        };
        const options = { headers: { 'Content-Type': 'application/json' }, timeout: 10000 };
        httpPost(url, payload, options);
    }
});
