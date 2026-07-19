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
