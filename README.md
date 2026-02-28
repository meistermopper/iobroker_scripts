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
