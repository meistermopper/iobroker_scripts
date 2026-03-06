# ioBroker Script-Sammlung

![GitHub last commit](https://img.shields.io/github/last-commit/meistermopper/iobroker_scripts?style=flat-square&color=blue)
![GitHub top language](https://img.shields.io/github/languages/top/meistermopper/iobroker_scripts?style=flat-square&color=yellow)
![GitHub repo size](https://img.shields.io/github/repo-size/meistermopper/iobroker_scripts?style=flat-square)
![ioBroker-Scripts](https://img.shields.io/badge/ioBroker-Scripts-orange?style=flat-square)

Diese Repository enthält meine persönliche Sammlung an Automatisierungsskripten für ioBroker. Die Skripte steuern verschiedene Aspekte meines Smart Homes, von der Energieoptimierung bis hin zur raumspezifischen Steuerung.

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
* **Monitoring**: Überwachung von USV-Status, Proxmox-Servern, FritzBox, Zigbee-Verfügbarkeit und Pi-hole [cite: 2026-02-23].
* **Telegram**: Zentrales Menü und Benachrichtigungsdienst für Statusmeldungen [cite: 2026-02-23].

---

## 🚀 Workflow & Synchronisation
Um Instabilitäten auf dem ioBroker-Server zu vermeiden, wurde die Versionsverwaltung vom Server entkoppelt.

* **Source of Truth**: Die primäre Entwicklungsumgebung ist **VS Code** auf dem lokalen Rechner.
* **Git-Status auf dem Server**: Das Verzeichnis `/home/iobroker/scripts/` auf dem Server enthält **kein** Git-Repository mehr. Dies verhindert Konflikte mit dem ioBroker-Dateisystem.
* **Backup & Cloud**: Der Push zu GitHub erfolgt ausschließlich manuell über VS Code, sobald ein Skript einen stabilen Zustand erreicht hat.

### Tägliche Arbeit
1. **Editieren**: Änderungen erfolgen direkt in VS Code.
2. **Deployment**: Durch die Spiegelung des JavaScript-Adapters (Pfad: `/home/iobroker/scripts/`) sind Änderungen sofort im ioBroker aktiv [cite: 2026-02-23].
3. **Sicherung**: 
   * `Commit`: Änderungen lokal in VS Code beschreiben und speichern.
   * `Push`: Stand zu GitHub hochladen (ersetzt den alten nächtlichen Cron-Job).

---

## ⚙️ Voraussetzungen
* ioBroker mit installiertem JavaScript-Adapter.
* Dateispiegelung im JavaScript-Adapter konfiguriert [cite: 2026-02-23].
* Git-Client & GitLens in VS Code zur Verwaltung der Historie.

---

## 📜 Annex: Repository-Standard
1. **Dateiberechtigungen**: Alle Dateien auf dem Server gehören dem User `iobroker`.
2. **Sauberkeit**: Der Ordner `common/beispiele/` wird durch die `.gitignore` ignoriert.
3. **Source of Truth**: Bei Unstimmigkeiten ist immer der Stand in VS Code bzw. auf GitHub maßgeblich.

---
Hinweis: Dies ist ein privates Projekt. Die Skripte sind individuell auf meine Hardware angepasst und dienen primär als Backup und Referenz.