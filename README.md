# ioBroker Script-Sammlung

Dieses Repository enthält meine persönliche Sammlung an Automatisierungsskripten für **ioBroker**. Die Skripte steuern verschiedene Aspekte meines Smart Homes, von der Energieoptimierung (PV & E-Auto) bis hin zur raumspezifischen Steuerung.

## 📂 Struktur

Die Skripte sind logisch nach Räumen und Funktionen gegliedert:

### ⚡ Energie & Mobilität (`common/smarthome/`)
* **KIA**: Steuerung von Ladeprozessen (`charge_master`), Vorklimatisierung und Statusabfragen über die Cloud [cite: 2026-02-23].
* **PV-Anlage**: Intelligentes Batteriemanagement, Solarprognosen (`solarprognose_master`) und Auswertung von Erzeugungsdaten [cite: 2026-02-23].
* **Verbrauch**: Tracking von Stromkosten und Verbräuchen einzelner Geräte wie Server oder Kühlschränke [cite: 2026-02-23].

### 🌡️ Haussteuerung
* **Heizung**: Präsenzabhängige Heizungssteuerung und Master-Logik für das gesamte Haus [cite: 2026-02-23].
* **Räume**: Individuelle Logiken für Bad, Küche, Sauna, Schlafzimmer und Wohnzimmer (Beleuchtung, Mediensteuerung für VU+ Solo 4K/Spotify/Denon) [cite: 2026-02-23].
* **Haushalt**: Überwachung von Haushaltsgeräten (Waschmaschine, Trockner) und Fenstersensoren [cite: 2026-02-23].

### 🛠️ System & Verwaltung
* **GitHub-Sync**: Automatische Synchronisation dieses Verzeichnisses mit GitHub zur Versionskontrolle [cite: 2026-02-23].
* **Monitoring**: Überwachung von USV-Status, Proxmox-Servern, FritzBox, Zigbee-Verfügbarkeit und Pi-hole [cite: 2026-02-23].
* **Telegram**: Zentrales Menü und Benachrichtigungsdienst für Statusmeldungen [cite: 2026-02-23].

## 🚀 Installation & Sync

Die Skripte werden automatisch zwischen dem ioBroker-Server und diesem Repository synchronisiert.

1. **Pfad auf dem Server**: `/home/iobroker/scripts/`
2. **Automatischer Sync**: Ein Cron-Job führt nachts (`00:07 Uhr`) das Skript `script_verwaltung.js` aus, um lokale Änderungen zu sichern [cite: 2026-02-23].
3. **Entwicklung**: Änderungen können bequem via VS Code durchgeführt und per Git gepusht werden.

## ⚙️ Voraussetzungen

* ioBroker mit installiertem **JavaScript-Adapter**.
* Dateispiegelung im JavaScript-Adapter ist auf `/home/iobroker/scripts` konfiguriert [cite: 2026-02-23].
* Git-Client auf dem Host-System.

---
**Hinweis:** Dies ist ein privates Projekt. Die Skripte sind individuell auf meine Hardware (Kia, Solaranlage, Proxmox etc.) angepasst und dienen primär als Backup und Referenz.

---

## Annex: Gold-Standard der Repository-Verwaltung

Um die Stabilität des Systems und die Synchronität zwischen ioBroker, GitHub und der lokalen Entwicklungsumgebung (VS Code) zu gewährleisten, gelten folgende Standards:

### 1. Verzeichnisstruktur & Sauberkeit
Das Arbeitsverzeichnis auf dem Server ist `/home/iobroker/scripts/`. 
* **Inhalt:** Nur die Ordner `common/` (produktive Skripte), `.git/` (Versionsverwaltung), die Datei `.gitignore` (Filter) und diese `README.md` sind zulässig.
* **Sauberkeit:** Keine leeren Verzeichnisse oder Dubletten durch unterschiedliche Groß-/Kleinschreibung (Case-Sensitivity) auf der Root-Ebene.

### 2. Berechtigungskonzept (Owner-Prinzip)
Alle Dateien und Ordner innerhalb des Repositorys gehören zwingend dem User **`iobroker`**.
* **Änderungen:** Manuelle Dateioperationen oder Git-Befehle auf der Konsole werden konsequent mit `sudo -u iobroker` ausgeführt.
* **Ziel:** Vermeidung von Berechtigungsfehlern (`Permission denied`) beim automatischen nächtlichen Backup-Lauf oder durch den JavaScript-Adapter.

### 3. Zentraler Workflow (Der `gitsync`-Alias)
Für die tägliche Arbeit wurde ein Alias definiert, der alle notwendigen Schritte bündelt:
`gitsync` führt folgende Kette als User `iobroker` aus:
1. `git pull` (Abgleich mit GitHub)
2. `git add .` (Index aktualisieren)
3. `git commit -m "Auto-Sync: [Zeitstempel]"` (Änderungen festschreiben)
4. `git push` (Sicherung in die Cloud)
5. `git status` (Abschlusskontrolle)

### 4. Entwicklung mit VS Code (Windows)
* Die lokale Bearbeitung erfolgt im Windows-Dateisystem.
* Vor und nach jeder Entwicklungssitzung wird ein `git pull` bzw. `git push` im VS Code Terminal durchgeführt.
* Die Datei `.gitignore` filtert aktiv Windows-spezifische Systemdateien (`Thumbs.db`, `desktop.ini`) und lokale Editor-Einstellungen (`.vscode/`) heraus.

### 5. Fehlerprävention & Monitoring
* **Logs:** Temporäre `ENOENT`-Fehler im ioBroker-Log während eines Git-Commits sind systembedingt (Race Condition des Watchers im `.git`-Verzeichnis) und können ignoriert werden.
* **Konsistenz:** Bei Unstimmigkeiten zwischen Server und Lokalversion ist GitHub als "Source of Truth" zu betrachten.
