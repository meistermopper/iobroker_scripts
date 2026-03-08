# ioBroker Script-Sammlung

![Umgebung](https://img.shields.io/badge/Umgebung-ioBroker-orange?style=flat-square)
![Zentrale](https://img.shields.io/badge/Editor-VS%20Code-blueviolet?style=flat-square)

Diese Repository enthält meine persönliche Sammlung an Automatisierungsskripten für ioBroker. Die Skripte steuern verschiedene Aspekte meines Smart Homes, von der Energieoptimierung bis hin zur raumspezifischen Steuerung.

## 📂 Struktur
Die Skripte sind logisch nach Räumen und Funktionen gegliedert:

### ⚡ Energie & Mobilität (`common/smarthome/`)
* **KIA**: Steuerung von Ladeprozessen (`charge_master`), Vorklimatisierung und Statusabfragen über die Cloud.
* **PV-Anlage**: Intelligentes Batteriemanagement, Solarprognosen (`solarprognose_master`) und Auswertung von Erzeugungsdaten.
* **Verbrauch**: Tracking von Stromkosten und Verbräuchen einzelner Geräte wie Server oder Kühlschränke.

### 🌡️ Haussteuerung
* **Heizung**: Präsenzabhängige Heizungssteuerung und Master-Logik für das gesamte Haus.
* **Räume**: Individuelle Logiken für Bad, Küche, Sauna, Schlafzimmer und Wohnzimmer (Beleuchtung, Mediensteuerung für VU+ Solo 4K/Spotify/Denon).
* **Haushalt**: Überwachung von Haushaltsgeräten (Waschmaschine, Trockner) und Fenstersensoren.

### 🛠️ System & Verwaltung
* **Monitoring**: Überwachung von USV-Status, Proxmox-Servern, FritzBox, Zigbee-Verfügbarkeit und Pi-hole.
* **Telegram**: Zentrales Menü und Benachrichtigungsdienst für Statusmeldungen.

---

## 🚀 Workflow & Synchronisation
Die Verwaltung der Skripte erfolgt getrennt nach Entwicklung (VS Code) und Laufzeit (ioBroker).

* **Source of Truth**: Die primäre Entwicklungsumgebung ist **VS Code** auf dem lokalen Rechner.
* **Git-Status auf dem Server**: Das Verzeichnis `/home/iobroker/scripts/` auf dem Server ist kein Git-Repository mehr.
* **Deployment (Live schalten)**: Die Übertragung zum ioBroker erfolgt manuell über die ioBroker-Extension.

### Tägliche Arbeit
1. **Editieren**: Änderungen direkt in VS Code vornehmen.
2. **Aktivieren**: Den Upload-Pfeil in der ioBroker-Seitenleiste nutzen.
3. **Sichern**: Commit & Push in VS Code.

---

## ⚙️ Voraussetzungen
* ioBroker mit installiertem JavaScript-Adapter.
* VS Code mit der **ioBroker Extension**.
* Git & GitLens zur Versionsverwaltung.

---

## 📜 Annex: Repository-Standard
1. **Dateiberechtigungen**: Alle Dateien auf dem Server gehören zwingend dem User `iobroker`.
2. **Sauberkeit**: Das Repository wird frei von temporären Systemdateien gehalten.
3. **Source of Truth**: Bei Unstimmigkeiten ist der Stand in VS Code maßgeblich.

---
*Hinweis: Dies ist ein privates Projekt.*