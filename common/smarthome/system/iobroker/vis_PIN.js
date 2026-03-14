/*******************************************************************************
 * ---------------------------
 * Pin-Schutz für VIS-View
 * ---------------------------
 * Autor: Mic
 * Change Log
 *  - 0.2 - Fix: 0 on keypad was not recognized
 *  - 0.1 - initial version
 * Support: https://forum.iobroker.net/viewtopic.php?f=30&t=19871
 ******************************************************************************/

/*******************************************************************************
 * Konfiguration
 ******************************************************************************/
const STATE_PATH = '0_userdata.0.VISPin.'; // Zentraler Pfad für alle PIN-Datenpunkte

const LOGGING = false;         // Detaillierte Ausgabe im Log. Falls keine Probleme, dann auf false setzen.


/*******************************************************************************
 * Konfiguration: Views
 ******************************************************************************/
// Es können beliebig mehr Views hinzugefügt werden.
// Der PIN wird jetzt sicher in einem Datenpunkt gespeichert, der automatisch angelegt wird.
const PIN_VIEWS = [
  {
    name: '420_ioBroker', // Name der View, zu der bei Erfolg gewechselt werden soll (pin-view 107_PIN)
    project: 'projektx', // VIS-Projekt, in dem die View ist, für den Viewwechsel bei Erfolg. Wert bekommt man u.a.: Vis -> Menü: Setup > Projekte (den Namen des jeweilgen Projektes nehmen)
    instance: 'FFFFFFFF', // Funktioniert bei mir (und einigen anderen) immer mit 'FFFFFFFF', ansonsten Wert vom Vis, Menü Tools, Feld "Instanz ID" nehmen
    pin:        '4712',       // Fallback-PIN: Wird beim ersten Start in den Datenpunkt geschrieben.
  },
  {
    name: '960_Auto',
    project: 'projektx',
    instance: 'FFFFFFFF',
    pin:        '4712',       // Fallback-PIN.
  },
];


/**********************************************************************************************************
 ++++++++++++++++++++++++++++ Ab hier nichts mehr ändern / Stop editing here! ++++++++++++++++++++++++++++
 *********************************************************************************************************/


/*******************************************************************************
 * Globale Variablen
 *******************************************************************************/
// Status-Objekt für alle Views (ersetzt die globalen Arrays)
const viewStates = {};

/*******************************************************************************
 * Executed on every script start.
 *******************************************************************************/
(async function init() {
    // 1. Datenpunkte anlegen (asynchron und sicher)
    for (const view of PIN_VIEWS) {
        const viewPath = STATE_PATH + view.name;
        await createStateAsync(viewPath + '.CurrentKey', { name: 'Mit Tasten aus VIS setzen', type: 'string', read: true, write: true, role: 'info', def: '' });
        await createStateAsync(viewPath + '.WrongPinEntered', { name: 'Pin-Fehler', type: 'boolean', read: true, write: false, role: 'info', def: false });
        await createStateAsync(viewPath + '.PinWildcards', { name: 'Sterne (*) für VIS-Anzeige', type: 'string', read: true, write: false, role: 'info', def: '' });

        // NEU: Datenpunkt für den PIN anlegen, falls er nicht existiert
        // Der PIN wird jetzt auch unter dem View-Pfad gespeichert
        const pinId = viewPath + '.PIN';
        view.pinId = pinId; // pinId zur Laufzeit hinzufügen für die spätere Verwendung

        if (!(await existsObjectAsync(pinId))) {
                await createStateAsync(pinId, view.pin || '', {
                    name: `PIN Code für View '${view.name}'`,
                    type: 'string',
                    role: 'text.password',
                    read: true,
                    write: true,
                });
            log(`PIN-Datenpunkt ${pinId} wurde mit dem Fallback-PIN angelegt.`, 'info');
        }

        // Status initialisieren
        viewStates[view.name] = { buffer: '', wildcards: '' };

        // Reset durchführen
        await resetPin(view.name);
    }

    // 2. Trigger starten (Regex für alle Views)
    // Baut einen Regex, der auf alle CurrentKey-Pfade passt
    const triggerPath = new RegExp('^' + STATE_PATH.replace(/\./g, '\\.') + '.*\\.CurrentKey$');

    on({id: triggerPath, change: "any"}, function (obj) {
        const currView = obj.id.substring(STATE_PATH.length, obj.id.lastIndexOf('.'));
        if (!currView || !viewStates[currView]) return;

        const val = obj.state.val;
        if (val === '') return; // Leere Änderungen ignorieren

        if (LOGGING) log('Eingabe erkannt, View: ' + currView);

        switch(String(val)) { // String-Cast zur Sicherheit
            case '0': case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8': case '9':
                    userEnteredNumber(currView, val);
                    break;
                case 'Enter':   // Der User hat die Pin-Eingabe bestätigt.
                    checkEnteredPin(currView);
                    break;
                case 'Reset':
                    resetPin(currView);
                    break;
                default:
                    if(LOGGING) log('Unbekannte Eingabe: ' + val);
        }
    });
})();


/********************************
 * Wird ausgeführt, sobald der User eine Nummer im Tastenfeld eingibt.
 * @param {string}   viewName     Name der View
 * @param {string}   key          Gedrückte Taste
 *********************************/
function userEnteredNumber(viewName, key) {
    viewStates[viewName].buffer += key;
    viewStates[viewName].wildcards += ' *';
    setState(STATE_PATH + viewName + '.PinWildcards', viewStates[viewName].wildcards, true);
}

/********************************
 * Wird ausgeführt, sobald der User E für "Enter" eingibt
 * @param {string}   viewName     Name der View
 ********************************/
function checkEnteredPin(viewName) {
    // Konfiguration für diese View suchen
    const viewConfig = PIN_VIEWS.find(v => v.name === viewName);
    if (!viewConfig) {
        log('Konfiguration für View ' + viewName + ' nicht gefunden!', 'error');
        return;
    }

    // Ziel-PIN ermitteln: Entweder direkt (pin) oder sicher über Datenpunkt (pinId)
    let targetPin = '';
    const pinId   = viewConfig.pinId;

    // Wenn eine pinId konfiguriert ist, überschreibe den Wert aus der Konfiguration
    if (pinId && existsState(pinId)) {
        targetPin = getState(pinId).val;
        if (LOGGING) log('PIN wird aus Datenpunkt gelesen: ' + pinId);
    } else if (pinId) {
        log(`PIN für View '${viewName}' konnte nicht geprüft werden. Datenpunkt '${pinId}' nicht gefunden oder hat keinen Wert.`, 'warn');
        return; // Abbruch, da kein PIN zum Vergleich vorhanden ist.
    } else {
        log(`PIN für View '${viewName}' konnte nicht geprüft werden. Kein 'pinId' in der Konfiguration gesetzt.`, 'warn');
        return; // Abbruch
    }

    if (LOGGING) log('Prüfe PIN für View [' + viewName + ']');

    // Vergleich (als String, um Typenprobleme zu vermeiden)
    if ((viewStates[viewName].buffer || '').toString() === (targetPin || '').toString()) {
        if(LOGGING) log('Pin-Eingabe erfolgreich, View [' + viewName + ']');
        onSuccess(viewConfig);
        setTimeout(() => resetPin(viewName), 3000);    // Reset nach 3 Sekunden
    } else {
        if(LOGGING) log('Falschen Pin eingegeben, View [' + viewName + ']');
        setState(STATE_PATH + viewName + '.WrongPinEntered', true, true); // ack: true setzen
        resetPin(viewName);
    }
}

/********************************
 * Reset
 * @param {string}   viewName     Name der View
 ********************************/
async function resetPin(viewName) {
    if (!viewStates[viewName]) return;

    // if(LOGGING) log('Reset Pin, View-Name: [' + viewName + ']'); // Spam im Log reduzieren
    viewStates[viewName].buffer = '';
    viewStates[viewName].wildcards = '';

    await setStateAsync(STATE_PATH + viewName + '.CurrentKey', '', true);
    await setStateAsync(STATE_PATH + viewName + '.PinWildcards', '', true);
    setStateDelayed(STATE_PATH + viewName + '.WrongPinEntered', false, true, 3000); // Erst nach 3 Sekunden, für VIS-Anzeige
}

/********************************
 * Wird bei erfolgreicher Pin-Eingabe ausgeführt
 * @param {object}   viewConfig   Konfigurationsobjekt der View
 ********************************/
function onSuccess(viewConfig){
    // Change View
    setState("vis.0.control.instance", viewConfig.instance);
    setState("vis.0.control.data",     viewConfig.project + '/' + viewConfig.name);
    setState("vis.0.control.command",  'changeView');
}
