# ioBroker Script-Sammlung











 

 

![Version](https://img.shields.io/badge/version-1.0.2-orange) Diese Repository enthält meine persönliche Sammlung an Automatisierungsskripten für ioBroker. Die Skripte steuern verschiedene Aspekte meines Smart Homes, von der Energieoptimierung bis hin zur raumspezifischen Steuerung.

## 📂 Struktur
Die Skripte sind logisch nach Funktionen und Räumen gegliedert und steuern zentrale Aspekte des Smart Homes.

### ⚡ Energie & Mobilität
*   **Smart Charging**: Intelligente Ladesteuerung zur Akkuschonung für Smartphones (`smartphones_laden.js`) und Wandtablets (`fully_smart_laden.js`). Die Skripte verwalten den Ladezyklus (z.B. 30-80%) und verhindern unnötiges Laden.
*   **KIA & PV**: (Nicht in den aktuellen Dateien, aber im Repo vorhanden) Steuerung von Ladevorgängen für E-Autos, PV-Überschussladung und Auswertung von Prognosen.

###  Haussteuerung
*   **Lichtautomatik**: Präsenz- und helligkeitsabhängige Lichtsteuerung. Die Skripte agieren als "Presence Follower", die das Licht exakt dem Zustand von Bewegungsmeldern folgen lassen und dabei nur schalten, wenn es nötig ist (z.B. `garderobenlicht.js`, `licht_presence.js` für die Küche).
*   **Haushalt & Außenbereich**: Überwachung des Postkastens mit Benachrichtigung per Telegram/Gotify und Sprachausgabe (`post_da.js`).
*   **Heizung & Medien**: (Nicht in den aktuellen Dateien) Präsenzabhängige Heizungssteuerung und individuelle Logiken für Mediensteuerung.

### 🛠️ System & Verwaltung
*   **Systemstabilität & Monitoring**:
    *   **Adapter-Überwachung**: Sendet eine Warnung, wenn ein ioBroker-Adapter ausfällt (`adapter_off.js`).
    *   **USV-Management**: Sichert bei Stromausfall den Zustand von Lampen und stellt diesen bei Netzrückkehr wieder her, um den letzten Zustand zu erhalten (`hue_zigbee_states_restore.js`).
    *   **Netzwerk-Failover**: Überwacht die Internetverbindung (UniFi), managt das Failover auf LTE und aktualisiert automatisch DynDNS-Einträge (`failover_dyndns_master.js`).
*   **Sicherheit & UI**:
    *   **PIN-Schutz**: Implementiert eine PIN-Sperre für sensible Bereiche in der VIS-Visualisierung (`vis_PIN.js`).
*   **Automatisierung**:
    *   **Auto-Versioning**: Ein Hilfsskript (`auto_version.js`), das bei Commits automatisch die Version in `package.json` und `CHANGELOG.md` erhöht.

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
