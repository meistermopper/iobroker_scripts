# ioBroker Skript-Sammlung

![Umgebung](https://img.shields.io/badge/Umgebung-ioBroker-orange?style=flat-square)
![Zentrale](https://img.shields.io/badge/Editor-VS%20Code-blueviolet?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0.19-success?style=flat-square)

Dieses Repository enthält meine persönliche Sammlung an Automatisierungsskripten für ioBroker. Die Skripte steuern verschiedene Aspekte meines Smart Homes, von der Energieoptimierung bis hin zur raumspezifischen Steuerung.

## 📂 Struktur
Die Skripte sind logisch nach Räumen und Funktionen gegliedert:

### ⚡ Energie & Laden
* **Smart Charging**: Intelligente Ladesteuerung für Wandtablet (`fully_smart_laden.js`) und Smartphones (`smartphones_laden.js`) zur Akkuschonung.
* **USV-Management**: Sichert und stellt den Zustand von Lampen und Steckdosen nach einem Stromausfall wieder her (`hue_zigbee_states_restore.js`).

### 💡 Licht & Präsenz
* **Raumlogik**: Präsenz- und helligkeitsabhängige Lichtsteuerung für verschiedene Bereiche:
    * **Bad unten**: Szenen für Morgen- und Standardlicht mit Dimm-Vorwarnung (`licht_bewegung_dunkel.js`).
    * **Garderobe**: Einfache "Presence Follower"-Logik (`garderobenlicht.js`).
    * **Küche**: Tag- und Nachtmodus mit gestaffeltem Schalten von Spots und Hue-Lampen (`licht_presence.js`).
    * **Wohnzimmer**: Helligkeits- und medialabhängige Lichtsteuerung

### 🏡 Haushalt & Außenbereich
* **Postkasten-Monitor**: Benachrichtigung bei Posteinwurf mit Sprachansage und VIS-Status (`post_da.js`).
* **Müllmeldung**: Am Vortag wird um 18:00 Uhr per Sprache und Nachricht die Abholung der Müllart am Folgetag angekündigt.

### 🛠️ System & Monitoring
* **ioBroker-Wächter**:
    * Überwacht Adapter und meldet Ausfälle nach einer Wartezeit (`adapter_off.js`).
    * Implementiert einen PIN-Schutz für sensible VIS-Views (`vis_PIN.js`).
* **Netzwerk-Management**:
    * Überwacht die WAN-IP auf Wechsel, steuert DDNS-Updates und managt Failover-Szenarien (`failover_dyndns_master.js`).

### 📺🎵 Medien
* **Medienauswahl**: Wird per Sprachbefehl gesteuert
* **Sauna**: Erkennt, wenn die Sauna läuft/nicht läuft und steuert zeitabhängig die Musikausgabe in Bad und Sauna.

---

## 🚀 Workflow & Synchronisation
Die Verwaltung der Skripte erfolgt getrennt nach Entwicklung (VS Code) und Laufzeit (ioBroker).

* **Source of Truth**: Die primäre Entwicklungsumgebung ist **VS Code** auf dem lokalen Rechner.
* **Git-Status auf dem Server und auf GitHub**
* **Deployment (Live schalten)**: Die Übertragung zum ioBroker erfolgt manuell über die ioBroker-Extension.

### Täglicher Workflow
1. **Editieren**: Änderungen direkt in VS Code vornehmen.
2. **Aktivieren**: Den Upload-Pfeil in der ioBroker-Seitenleiste nutzen.
3. **Sichern**: Commit & Push & GitHub Sync in VS Code.

---

## ⚙️ Setup
* ioBroker mit installiertem JavaScript-Adapter.
* VS Code mit der **ioBroker Extension**.
* Git & GitLens zur Versionsverwaltung.

---

## 📜 Annex: Repository-Standard
1. **Dateiberechtigungen**: Alle Dateien auf dem Server gehören zwingend dem User `iobroker`.
2. **Sauberkeit**: Das Repository wird frei von temporären Systemdateien gehalten.
3. **Source of Truth**: Bei Unstimmigkeiten ist der Stand in VS Code maßgeblich.

---

## 📝 Changelog

Alle wichtigen Änderungen dieses Projekts werden hier dokumentiert.

### [1.0.19] - 2026-03-08
- delete CHANGELOG.md

### [1.0.12] - 2026-03-08
- Update von fenster_offen.js
- Update von trockner.js
- Update von waschmaschine.js
- Update von vu_reboot_standby.js
- Update von auto_version.js

### [1.0.7] - 2026-03-08
- Dokumentation und Skripte aktualisiert

### [1.0.1] - 2026-03-08
- aktuelle Skripte und automatische Versionierung initiiert

---
*Hinweis: Dies ist ein privates Projekt.*
