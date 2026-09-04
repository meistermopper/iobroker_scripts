<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">

[🇬🇧 English Version](README.md)
<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">

[🇬🇧 English Version](README.md)

# ioBroker Skript-Sammlung

![Environment](https://img.shields.io/badge/Environment-ioBroker-orange?style=flat-square)
![Language - JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=black&style=flat-square)
![Linter - Biome](https://img.shields.io/badge/Linter-Biome-60A5FA?logo=biome&logoColor=white&style=flat-square)
![Editor](https://img.shields.io/badge/Editor-Antigravity%20IDE-blueviolet?style=flat-square)
![Version](https://img.shields.io/badge/Version-3.3.20-success?style=flat-square)

Dieses Repository enthält meine persönliche Sammlung von Automatisierungsskripten für ioBroker. Diese Skripte steuern verschiedene Aspekte meines Smart Homes, von der Energieoptimierung bis hin zur raumspezifischen Steuerung.

## 📂 Struktur

Die Skripte sind logisch nach Räumen und Funktionen gegliedert:

### ⚡ Energie & Laden

- **EV Lade-Master (`charge_master.js`)**: Verwaltet den gezielten Start/Stopp für das Laden des Kia EV3 basierend auf PV-Überschuss oder manueller Eingabe. Beinhaltet Batterieschutz für den Hausspeicher bei manuellem Laden, robuste Stopp-Mechanismen für hängende Wallbox-Zustände, Verbindungsüberwachung und intelligente Wallbox-Resets, um zuverlässiges Laden zu gewährleisten. Optimiert die Zeitformatierung, Kilometerberechnung und bietet detaillierte Statistiken.
- **Intelligentes Laden (`fully_smart_laden.js`, `smartphones_laden.js`)**: Intelligente Ladesteuerung für wandmontierte Tablets und smartphones zur Schonung der Batterie (z.B. 30-70% Strategie) und Steuerung der automatischen Display-Abschaltung. Enthält selbstheilende Datenpunkte, intelligente Benachrichtigungen und Sprachsteuerungs-Trigger.
- **Solar-Prognose (`solarprognose_master.js`)**: Visualisiert die Solarstromproduktion von heute und morgen mit individuellem Skalierungsfaktor (`PV_FACTOR = 1.39`), vergleicht Prognosen mit Ist-Werten (Ertrag) und unterstützt Telegram/Gotify-Benachrichtigungen bei Updates.
- **USV Management**: Sichert den Zustand von Lichtern und Steckdosen nach einem Stromausfall und stellt diesen wieder her (`hue_zigbee_states_restore.js`).

### 💡 Licht & Präsenz

- **Raum-Logik**: Präsenz- und helligkeitsabhängige Lichtsteuerung für verschiedene Bereiche:
  - **Unteres Badezimmer**: Szenen für morgendliche und Standard-Beleuchtung mit Dimm-Vorwarnung (`licht_bewegung_dunkel.js`).
  - **Garderobe (`garderobenlicht.js`)**: Einfache "Präsenz-Folger"-Logik, die sicherstellt, dass das Licht effizient dem Status des Präsenzmelders entspricht.
  - **Küche**: Tag- und Nachtmodus mit versetztem Schalten von Spots und Hue-Lampen (`licht_presence.js`).
  - **Wohnzimmer**: Helligkeits- und medienabhängige Lichtsteuerung.

### 🏡 Haus & Außenbereich

- **Briefkasten-Monitor (`post_da.js`)**: Benachrichtigt bei Postzustellung mit Sprachansagen und aktualisiert den VIS-Status. Verhindert doppelte Benachrichtigungen und handhabt Tag/Nacht-Modi für Ansagen.
- **Mähroboter-Steuerung (R2Mäh2) (`zustand_r2maeh2.js`)**: Überwacht den Status des Mähers über den Stromverbrauch, sendet Benachrichtigungen (Start, Ende, Probleme, Frostwarnung), führt Sprachansagen durch und berechnet tägliche Statistiken sowie Stromkosten.
- **Badezimmer Entfeuchtung (`heizen_rh.js`)**: Steuert die Fußbodenheizung im Bad zur Reduzierung der Luftfeuchtigkeit nach dem Duschen (Schimmelprävention). Aktiviert die Heizung auf 24°C bei steigender Luftfeuchtigkeit, mit Fensterschutz und automatischem Reset auf vorherige oder Standardtemperaturen.
- **Terrassen-Klingel (`anruf_klingel_terrasse.js`)**: Kündigt Haustürklingeln und Telefonanrufe der FRITZ!Box über SayIt auf dem Terrassen-Google-Speaker mit dynamischer Lautstärkeanpassung an, sendet Kurznachrichten und lässt bei jedem Türklingeln die Wohnzimmer-Lampen "Ei" (in Blau) und "Kommode" zur optischen Signalisierung blinken.
- **Müllabfuhr-Benachrichtigung**: Sagt die Müllabfuhr für den nächsten Tag per Sprache und Nachricht am Vorabend um 18:00 Uhr an und visualisiert diese.
- **Lüftungsempfehlungen**: Basierend auf der Innen- und Außentemperatur sowie der Luftfeuchtigkeit.
- **Gefahrenmelder**: Akustische und nachrichtenbasierte Rauch- und Wasserwarnungen sowie Kohlenmonoxid-Überwachung am Kachelofen (`co_warnung_kachelofen.js`) mit lautstarken SayIt-Sprachansagen (100%), Telegram und Gotify.
- **Haushaltsgeräte**: Statusmeldungen für Waschmaschine, Spülmaschine und Trockner mit ausführlichen Details per Telegram/Gotify und prägnanten Sprachansagen nach Fertigstellung.
- **Anwesenheitserkennung**: Über Smartphones im WLAN (UniFi Network Adapter).
- **Heizungssteuerung**: Abhängig von der Anwesenheit.
- **Homematic Service Center**: Überwacht UNREACH, LOWBAT, CONFIG_PENDING und CCU-Firmware.
- **Batteriestände**: Überwacht alle batteriebetriebenen Geräte und warnt bei niedrigem Stand.

### 🛠️ System & Überwachung

- **ioBroker Watchdog**:
  - Überwacht Adapter und meldet Ausfälle nach einer Wartezeit (`adapter_off.js`).
  - Implementiert einen PIN-Schutz für sensible VIS-Ansichten (`vis_PIN.js`).
  - **SayIt AutoFix (`sayit_autofix.js`)**: Überwacht proaktiv und repariert reaktiv den Cache-Symlink des SayIt-Adapters, stellt die dauerhafte Funktion der Sprachausgabe sicher und verhindert 'ENOENT'-Fehler.
- **Netzwerkmanagement**:
  - Überwacht die WAN-IP auf Änderungen, steuert DDNS-Updates und verwaltet Failover-Szenarien (`failover_dyndns_master.js`).
- **Proxmox Cluster Master Watchdog**: Überwacht Temperatur, Festplatten & Status - sendet Alarme an ALLE Telegram-Nutzer und Gotify.
- **DrayTek Vigor 166 Monitor (`connected.js`)**: Startet einen lokalen HTTP-Server für Grafana-Webhook-Alerts, um den DSL-Verbindungsstatus zu überwachen und Benachrichtigungen zu senden.
- **Globale Benachrichtigungen (`notify.js`)**: Zentralisiert Benachrichtigungen über Telegram, Gotify und Sprachansagen auf Chromecast-Geräten inkl. intelligenter Wiedergabe-Fortsetzung (Resume-Funktion) sowie Unterstützung für abweichende, kurze Sprachtexte.
- **Telegram Steuerzentrale (`telegram_menue.js`)**: Interaktives Telegram-Bot-Menü zur Überwachung von Raumklima, Fensterstatus, Kia-Standort, Terminen, Astrozeiten und Direkt-Schaltung von Terrassen-/Außengeräten.
- **Fußball Bundesliga**: Zeigt die aktuelle Tabelle und kommende Spiele von SGE und FCB mittels OpenLigaDB-Adapter an.

### 📺🎵 Medien & Sauna

- **Sauna- & Audio-Master (`session_master.js`)**: Steuert HEOS-Wiedergabelisten und die zeitversetzte Musikwiedergabe in Sauna und Bad während des Saunabetriebs. Integriert die Lichtsynchronisation und Benachrichtigungen über den nativen `harvia-fenix`-Adapter (`harvia-fenix.0`).
- **Medienauswahl**: Gesteuert per Sprachbefehl und Google Home.
- **Ziegenhain Navigations-Ansage (`ziegenhain.js`)**: Löst als Reaktion auf einen bestimmten Sprachbefehl eine humorvolle Sprachansage auf allen aktiven SayIt-Instanzen im Haus aus.

---

## 🚀 Workflow & Synchronization

Die Skriptverwaltung ist aufgeteilt zwischen Entwicklung (Antigravity IDE) und Laufzeit (ioBroker).

- **Source of Truth**: Die primäre Entwicklungsumgebung ist **Antigravity IDE** auf dem lokalen Rechner.
- **Git Status**: Wird auf dem Server und bei GitHub verwaltet.
- **Deployment (Go Live)**: Die Übertragung zu ioBroker erfolgt manuell über die ioBroker Extension.

### Täglicher Workflow

1. **Editieren**: Änderungen direkt in der Antigravity IDE vornehmen.
2. **Aktivieren**: Den Upload-Pfeil in der ioBroker-Seitenleiste verwenden.
3. **Speichern**: Commit & Push & GitHub Sync in der Antigravity IDE ausführen.

---

## ⚙️ Setup

- ioBroker
- Antigravity IDE
- Git & GitLens zur Versionskontrolle.

---

## 📜 Anhang: Repository Standards

1. **Dateiberechtigungen**: Alle Dateien auf dem Server müssen dem Benutzer `iobroker` gehören.
2. **Sauberkeit**: Das Repository wird frei von temporären Systemdateien gehalten.
3. **Source of Truth**: Bei Unstimmigkeiten ist der Zustand in der Antigravity IDE maßgeblich.

---

## 📝 Changelog

### [3.3.20] - 2026-09-04
- feat(homematic): Implement UNREACH debouncing to prevent false alarms (homematic_all.js)

### [3.3.19] - 2026-09-03
- git commit -m "fix(homematic): add all-clear notification, debounce triggers, and HmIP LOW_BAT support (homematic_all.js)

### [3.3.18] - 2026-09-03
- git commit -m "fix: increase gotify http request timeout to 15s (notify.js)

### [3.3.17] - 2026-09-03
- git commit -m "fix(telegram): ignore empty request values to prevent unknown command logs (telegram_menue.js)

### [3.3.16] - 2026-08-27
- refactor(vigor166): Translate script content and comments to English (connected.js)

Ältere Einträge finden sich im [Changelog-Archiv](CHANGELOG_OLD.md).
