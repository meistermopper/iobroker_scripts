<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">

[🇬🇧 English Version](README.md)

# ioBroker Skript-Sammlung

![Environment](https://img.shields.io/badge/Environment-ioBroker-orange?style=flat-square)
![Language - JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=black&style=flat-square)
![Linter - Biome](https://img.shields.io/badge/Linter-Biome-60A5FA?logo=biome&logoColor=white&style=flat-square)
![Editor](https://img.shields.io/badge/Editor-Antigravity%20IDE-blueviolet?style=flat-square)
![Version](https://img.shields.io/badge/Version-3.0.5-success?style=flat-square)

Dieses Repository enthält meine persönliche Sammlung von Automatisierungsskripten für ioBroker. Diese Skripte steuern verschiedene Aspekte meines Smart Homes, von der Energieoptimierung bis hin zur raumspezifischen Steuerung.

## 📂 Struktur

Die Skripte sind logisch nach Räumen und Funktionen gegliedert:

### ⚡ Energie & Laden

- **EV Lade-Master (`charge_master.js`)**: Verwaltet den gezielten Start/Stopp für das Laden des Kia EV3 basierend auf PV-Überschuss oder manueller Eingabe. Beinhaltet Batterieschutz für den Hausspeicher bei manuellem Laden, robuste Stopp-Mechanismen für hängende Wallbox-Zustände, Verbindungsüberwachung und intelligente Wallbox-Resets, um zuverlässiges Laden zu gewährleisten. Optimiert die Zeitformatierung, Kilometerberechnung und bietet detaillierte Statistiken.
- **Harvia Sauna Steuerung (`Fenix_FX110C_Sauna_control.js`)**: Bietet die volle Fernsteuerung der Harvia Fenix FX 110C Sauna, einschließlich Heizung, Beleuchtung und Temperatureinstellungen über die REST-API. Verfügt über robustes Token-Management, Fehlerbehandlung und Echtzeit-Statusüberwachung.
- **Intelligentes Laden (`fully_smart_laden.js`, `smartphones_laden.js`)**: Intelligente Ladesteuerung für wandmontierte Tablets und Smartphones zur Schonung der Batterie (z.B. 30-70% Strategie) und Steuerung der automatischen Display-Abschaltung. Enthält selbstheilende Datenpunkte, intelligente Benachrichtigungen und Sprachsteuerungs-Trigger.
- **Solar-Prognose**: Visualisiert die Solarstromproduktion von heute und morgen.
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
- **Müllabfuhr-Benachrichtigung**: Sagt die Müllabfuhr für den nächsten Tag per Sprache und Nachricht am Vorabend um 18:00 Uhr an und visualisiert diese.
- **Lüftungsempfehlungen**: Basierend auf der Innen- und Außentemperatur sowie der Luftfeuchtigkeit.
- **Gefahrenmelder**: Akustische und nachrichtenbasierte Rauch- und Wasserwarnungen.
- **Haushaltsgeräte**: Statusmeldungen für Waschmaschine, Spülmaschine und Trockner.
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
- **Fußball Bundesliga**: Zeigt die aktuelle Tabelle und kommende Spiele von SGE und FCB mittels OpenLigaDB-Adapter an.

### 📺🎵 Medien

- **Medienauswahl**: Gesteuert per Sprachbefehl und Google Home.
- **Ziegenhain Navigations-Ansage (`ziegenhain.js`)**: Löst als Reaktion auf einen bestimmten Sprachbefehl eine humorvolle Sprachansage auf allen aktiven SayIt-Instanzen im Haus aus.

---

## 🚀 Workflow & Synchronisation

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

### [3.0.5] - 2026-07-02

- feat: implement solar prognosis, secret management, Unifi monitoring, and Telegram menu modules (charge_master.js, climate_control.js, location_and_status.js, solarprognose_master.js, setup_secrets.js, network_version.js, telegram_menue.js)

### [3.0.4] - 2026-07-01

- feat: add Harvia Fenix sauna controller and automated bedroom lighting script (Fenix_FX110C_Sauna_control.js, schranklicht.js)

### [3.0.3] - 2026-06-30

- feat: add global notification utility for Telegram, Gotify, and Chromecast announcements (notify.js)

### [3.0.2] - 2026-06-29

- feat: add Harvia Fenix FX 110C sauna control script with cloud integration (Fenix_FX110C_Sauna_control.js)

### [3.0.1] - 2026-06-29

- feat: add multiple automation scripts and configurations for ioBroker management (licht_bewegung_dunkel.js, licht_bewegung_dunkel.js, switch_neu_starten.js, Weihnachtsbaum_Terrasse.js, post_da.js, zustand_r2maeh2.js, Wasserdruckwarnung.js, morgenprogramm.js, trockner.js, waschmaschine.js, Fenix_FX110C_Sauna_control.js, session_master.js, heizung_anwesenheit_master.js, charge_master.js, climate_control.js, location_and_status.js, energiemaster_und_sauna.js, solarprognose_master.js, homematic_all.js, kalender.js, weihnachtszeit.js, battery_states.js, chromecast_ban_heos.js, sayit_autofix.js, sonoff_devices_table.js, syslog_monitor.js, tasmota_fw.js, vaillant_Neustart.js, versionen.js, vis_PIN.js, ziegenhain.js, domains_blocked.js, versionen.js, network_version.js, neue_ip_failover.js, hue_zigbee_states_restore.js, telegram_menue.js, termine_2T.js, radio_manuell.js, baum_Zeitschalt.js, switch_alle_lampen.js, videolicht.js, fully_bewegung.js, ladestation_neustart_hub.js, smartphones_laden.js, switch_ventilator.js, notify.js)

Ältere Einträge finden sich im [Changelog-Archiv](CHANGELOG_OLD.md).

---

_Hinweis: Dies ist ein privates Projekt._
