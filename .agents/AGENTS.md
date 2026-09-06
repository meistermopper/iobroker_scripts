# ioBroker Javascript Scripting-Regeln

Dieses Dokument definiert die spezifischen Standards und Best Practices für ioBroker-Skripte in diesem Workspace. Halte dich bei allen Codeänderungen strikt an diese Vorgaben.

## 1. Benachrichtigungen (Telegram & Gotify)

- **Telegram-Benachrichtigungen:**
  - Sollen immer über den Telegram-Adapter gesendet werden:
    ```javascript
    sendTo("telegram", "send", {
      text: msg,
      // optional bei HTML-Formatierung:
      parse_mode: "HTML",
    });
    ```
- **Gotify-Benachrichtigungen:**
  - Verwende **niemals** externe Tools wie `exec` mit `curl` für Gotify-Benachrichtigungen!
  - Verwende immer die native `httpPost()` Funktion.
  - Der Gotify-Server ist standardmäßig `https://mygotify.meistermopper.de/message?token=${token}`.
  - Der Gotify-Token soll aus dem Datenpunkt `0_userdata.0.gotifytoken.iobroker` ausgelesen werden:
    ```javascript
    const gotifyToken = getState("0_userdata.0.gotifytoken.iobroker")?.val;
    ```

## 2. Struktur von JavaScript-Dateien

Jedes Skript sollte in zwei logische Abschnitte unterteilt sein:

1.  **Dateikopf (Metadaten):**
    Ein JSDoc-Block ganz oben mit `Name` und `Zweck` des Skripts:
    ```javascript
    /**
     * Name:   [Name des Skripts]
     * Zweck:  [Kurzbeschreibung der Funktionalität]
     */
    ```
2.  **Konfiguration (`// --- KONFIGURATION ---`):**
    Definition aller Konstanten, Selektoren und Tokens am Anfang des Skripts.
3.  **Logik (`// --- LOGIK ---`):**
    Definition der Event-Listener (`on()`, `schedule()`) und Funktionen.

## 3. Typisierung & Linting

- **jQuery-ähnliche Trigger (`$()`):**
  Wenn Selektoren wie `$(ID_SELECTOR)` in Triggern verwendet werden, setze einen `// @ts-ignore` Kommentar direkt über die Zeile mit `on()`, um TypeScript-Fehlermeldungen im Editor zu unterdrücken, falls diese auftreten:
  ```javascript
  // @ts-ignore
  on({ id: $(ID_SELECTOR), ... }, (obj) => { ... });
  ```
- **ESLint-Umgebung (Linter im ioBroker-Editor):**
  Damit der ioBroker-interne Linter moderne JavaScript-Features (wie Optional Chaining `?.` und Trailing Commas) nicht als Fehler markiert, soll ganz oben in jedem Skript (noch vor dem Dateikopf) folgender Kommentar eingefügt werden:
  ```javascript
  /* eslint-env es2022 */
  ```
- **Formatierung:**
  - Verwende **2 Leerzeichen** zur Einrückung.
  - Konstanten/Variablen im Konfigurationsbereich in `const` definieren.

## 4. Logging & Fehlerbehandlung

- Verwende `console.log()`, `console.warn()` oder `console.error()` statt der veralteten globalen `log()` Funktion.
- Bei Warnungen oder Fehlern sollte der Log-Meldung der Name des Skripts in eckigen Klammern vorangestellt werden:
  ```javascript
  console.error(`[Sonoff Fail] Gotify Fehler: ${error}`);
  ```

## 5. Kommentierung & Lesbarkeit

- **Ausführliche Kommentierung:**
  Alle Skripte müssen ausführlich kommentiert werden. Jede logische Entscheidung, Datenpunkt-Verknüpfung, Timeouts und Hilfsfunktion muss klar dokumentiert sein. Kommentare im Code (JSDoc-Blöcke und Inline-Kommentare) sind immer auf Englisch zu verfassen (gemäß Sprachregelung), müssen jedoch so verständlich und detailliert sein, dass die Logik und der Ablauf der Skripte ohne Rätselraten nachvollzogen werden können.

## 6. Objektexistenzprüfung & Objektmanipulation

- **Datenpunkterstellung in Skripten (`createStateAsync` statt `setObjectNotExists`):**
  - **Verwende niemals `setObjectNotExists` oder `setObjectNotExistsAsync` in Skripten!** Diese Methoden existieren nur im ioBroker-Adapter-Kontext. In Skripten der JavaScript-Engine führen sie zu einem `ReferenceError: setObjectNotExists is not defined`.
  - Verwende zur Erstellung neuer Datenpunkte immer `await createStateAsync(id, defVal, { name, type, role, read, write, unit })` oder `createState()`.
- **Objektexistenz vor `extendObject()` / `setObject()` prüfen:**
  - Bevor bestehende Objekte oder deren Metadaten via `extendObject()` oder `setObject()` verändert werden, **muss** immer mit `existsObject(id)` (oder `await existsObjectAsync(id)`) geprüft werden, ob das Objekt in der Objektdatenbank existiert.
    ```javascript
    if (existsObject(id)) {
      extendObject(id, { ... });
    }
    ```
  - **Hintergrund:** Ein Aufruf von `extendObject()` auf nicht existierende Objekt-IDs führt im ioBroker js-controller zu Fehlermeldungen (`Object "..." can't be copied: {}`).

## 7. Date-Arithmetik (TypeScript-Konformität)

- Bei Differenzberechnungen oder Vergleichen von `Date`-Objekten verwende immer `.getTime()` (z. B. `date.getTime() - start.getTime()`), um TypeScript-Compilerfehler bezüglich arithmetischer Operatoren zu vermeiden.

## 8. Asynchrone Robustheit, Race Conditions & Lifecycle (Skript-Sicherheit)

Um hängende Zustände, doppelte Hardware-Aktionen und Speicherlecks zu verhindern, müssen komplexe Steuerungs- und Ladeskripte folgende Schutzmechanismen einhalten:

- **Schutz vor doppelter Ausführung (Mutex / Concurrency Guards):**
  - Funktionen, die zeitintensive oder hardwarenahe Aktionen ausführen (z. B. Soft-Resets, Ladelimit-Wechsel), müssen durch boolesche Sperrvariablen (z. B. `isRestoring`, `isChangingLimit`) vor gleichzeitigen Aufrufen geschützt werden.
  - Wenn ein Skript selbst Datenpunkte schreibend ändert (`setState(id, val, true)`), die wiederum von eigenen Event-Listenern überwacht werden, muss im Listener geprüft werden, ob die Aktion bereits läuft (`if (isRestoring) return;`) oder ob es sich um einen externen Befehl handelt (`state.ack === false`).

- **Zustandsunabhängige Wiederherstellung (State Restoration):**
  - Werden bei Beginn einer Session Originalwerte zwischengespeichert (z. B. `originalMinSoc`, Grenzwerte), muss deren Rückstellung bei Session-Ende **ausschließlich** daran gekoppelt sein, ob ein Wert gemerkt wurde (`if (originalMinSoc !== null)`).
  - Die Wiederherstellung darf **niemals** von variablen UI-Schaltern (wie z. B. `!isAuto`) abhängen, da der Benutzer diese während einer laufenden Session umschalten kann und der Wert sonst dauerhaft gesperrt bliebe.

- **Verzögerte Watchdogs & Timer-Kollisionen:**
  - Timer zur Fehlererkennung (z. B. 10s-Verzögerung nach Stopp-Befehl) müssen vor dem Ausführen eines Not-Stopps (`forceStop`) prüfen, ob der Stopp-Zustand immer noch vorliegt (`getState(id).val === false`). Andernfalls werden neu gestartete Aktionen versehentlich abgewürgt.
  - Beim Starten neuer Sequenzen (z. B. Ladestart) müssen etwaige noch laufende Stopp- oder Entprell-Timer (`stopTimer`) vorher explizit gecancelt werden (`clearTimeout(stopTimer); stopTimer = null;`).

- **Cloud-Latenzen berücksichtigen:**
  - Bei Datenpunkten aus Cloud-Adaptern (z. B. Fahrzeug-SoC bei Bluelink/Connect) hinken Werte der Realität oft hinterher. Statusprüfungen für Session-Enden dürfen nicht rein auf strikte Cloud-Werte vertrauen, sondern müssen Hardware-Meldungen (`SuspendedEV`, `Finishing`, Stecker abgezogen) oder Toleranzpuffer (`evSoc >= targetSoc - 2`) einbeziehen.

- **Interlocks in Not-Aus- / Exception-Pfaden:**
  - Wenn Verriegelungen oder Pausen aktiv sind (z. B. Sauna-Interlock mit `u_pausedBySauna`), dürfen auch `finally`-Blöcke oder `forceStopCharging()`-Routinen gespeicherte Session-Parameter nicht überschreiben oder löschen, damit die automatische Wiederaufnahme nach dem Interlock funktioniert.

- **Lifecycle-Cleanup mit `onStop()`:**
  - Alle im Skript erzeugten `setInterval`- und `setTimeout`-Timer müssen in globalen Variablen gehalten und in einem `onStop()`-Handler bei Skript-Neustart oder -Beendigung explizit aufgeräumt werden:
    ```javascript
    onStop((callback) => {
      if (stopTimer) clearTimeout(stopTimer);
      if (reconnectInterval) clearInterval(reconnectInterval);
      callback();
    });
    ```

- **Initialisierungs-Absicherung:**
  - Asynchrone Initialisierungsfunktionen (`initSystem()`) müssen durch ein Flag (`isSystemInitialized`) signalisieren, wenn alle Datenpunkte und Speicherwerte geladen sind. Zyklische Timer oder Trigger sollten erst agieren, wenn `isSystemInitialized === true` ist.
