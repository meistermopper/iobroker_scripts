![Version](https://img.shields.io/github/package-json/v/meistermopper/iobroker_scripts)
# ioBroker Script-Sammlung

![Status](https://img.shields.io/badge/Status-aktiv-blue?style=flat-square)
![Sprache](https://img.shields.io/badge/Sprache-JavaScript-yellow?style=flat-square)
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
* **Git-Status auf dem Server**: Das Verzeichnis `/home/iobroker/scripts/` auf dem Server ist kein Git-Repository mehr. Dies verhindert Dateikonflikte und ungewollte Skriptstopps.
* **Deployment (Live schalten)**: Die Übertragung zum ioBroker erfolgt manuell über die ioBroker-Extension. Erst durch Klicken auf den **Upload-Pfeil** im Bereich "CHANGED SCRIPTS" wird der Code zum ioBroker übertragen und dort sofort aktiviert.

### Tägliche Arbeit
1. **Editieren**: Änderungen direkt in VS Code vornehmen und speichern.
2. **Aktivieren**: Den Upload-Pfeil in der ioBroker-Seitenleiste nutzen, um das Skript live zu schalten.
3. **Sichern**: 
   * `Commit`: Änderungen lokal in VS Code beschreiben und speichern.
   * `Push/Sync`: Stand zu GitHub hochladen (ersetzt das alte nächtliche Backup).

---

## ⚙️ Voraussetzungen
* ioBroker mit installiertem JavaScript-Adapter.
* VS Code mit der **ioBroker Extension** für das Deployment.
* Git & GitLens in VS Code zur Versionsverwaltung.

---

## 📜 Annex: Repository-Standard
1. **Dateiberechtigungen**: Alle Dateien auf dem Server gehören zwingend dem User `iobroker`.
2. **Sauberkeit**: Das Repository wird frei von temporären Systemdateien gehalten (via `.gitignore`).
3. **Source of Truth**: Bei Unstimmigkeiten zwischen Server und Lokalversion ist der Stand in VS Code maßgeblich.

---
*Hinweis: Dies ist ein privates Projekt. Die Skripte sind individuell auf meine Hardware angepasst und dienen primär als Backup und Referenz.*