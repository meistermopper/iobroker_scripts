<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">
# ioBroker Skript-Sammlung

![Umgebung](https://img.shields.io/badge/Umgebung-ioBroker-orange?style=flat-square)
![Zentrale](https://img.shields.io/badge/Editor-VS%20Code-blueviolet?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.9.10-success?style=flat-square)

Dieses Repository enthält meine persönliche Sammlung an Automatisierungsskripten für ioBroker. Die Skripte steuern verschiedene Aspekte meines Smart Homes, von der Energieoptimierung bis hin zur raumspezifischen Steuerung.

## 📂 Struktur
Die Skripte sind logisch nach Räumen und Funktionen gegliedert:

### ⚡ Energie & Laden
* **UNIVERSAL MASTER v2.7 - THE ENERGY GUARDIAN**: ZWECK: Zentrale Steuerung von PV, Batterie, Sauna und Wallbox.
 * RECHENKERN: Physikalische Berechnung von Hausverbrauch und Autarkie.
 * SCHUTZLOGIKEN:
 * 1. Sauna-Priorisierung: Schützt die Batterie vor Hochstrom-Entladung.
 * 2. Anti-Zappel: Verhindert Min-SoC-Sprünge bei taktendem Saunaofen.
 * 3. Watchdog: Überwacht Änderungen des Min-SoC am Wechselrichter.
 * 4. Safety-Guard: Warnt, wenn die Sauna bei offener Tür heizt.
* **Überschussladen**: steuert die Wallbox in Abhängigkeit von Stromüberschuss und Ladeziel des Kfz
* **Energie-Master**: Zentrale Steuerung von PV, Batterie, Sauna und Wallbox mit physikalischer Berechnung von Hausverbrauch und Autarkie (`energiemaster_und_sauna.js`)
* **Smart Charging**: Intelligente Ladesteuerung für Wandtablet (`fully_smart_laden.js`) und Smartphones (`smartphones_laden.js`) zur Akkuschonung
* **Solarprognose**: Visualisierung der Werte von heute und morgen
* **USV-Management**: Sichert und stellt den Zustand von Lampen und Steckdosen nach einem Stromausfall wieder her (`hue_zigbee_states_restore.js`)

### 💡 Licht & Präsenz
* **Raumlogik**: Präsenz- und helligkeitsabhängige Lichtsteuerung für verschiedene Bereiche:
    * **Bad unten**: Szenen für Morgen- und Standardlicht mit Dimm-Vorwarnung (`licht_bewegung_dunkel.js`)
    * **Garderobe**: Einfache "Presence Follower"-Logik (`garderobenlicht.js`)
    * **Küche**: Tag- und Nachtmodus mit gestaffeltem Schalten von Spots und Hue-Lampen (`licht_presence.js`)
    * **Wohnzimmer**: Helligkeits- und medienabhängige Lichtsteuerung

### 🏡 Haushalt & Außenbereich
* **Postkasten-Monitor**: Benachrichtigung bei Posteinwurf mit Sprachansage und VIS-Status (`post_da.js`)
* **Müllmeldung**: Am Vortag wird um 18:00 Uhr per Sprache und Nachricht die Abholung der Müllart am Folgetag angekündigt und visualisiert.
* **Lüftungsempfehlungen**: In Abhängigkeit von Temperatur und Luftfeuchtigkeit (innen und außen)
* **Spritpreise**: Auswertung günstigste Tankstelle in der Nähe und Visualisierung
* **Alarmmelder**: Rauch- und Wasserwarnungen akustisch und per Nachricht
* **Haushaltsgeräte**: Statusmeldungen für Waschmaschine, Geschirrspüler und Trocker
* **Anwesenheit**: Über Smartphones vermittels WLAN (UniFi-Network-Adapter)
* **Heizungssteuerung**: je nach Anwesenheit
* **Homematic Service-Zentrale**:  überwacht UNREACH, LOWBAT, CONFIG_PENDING und CCU-Firmware
* **Ladezustände**: überwacht alle akkubetriebenen Geräte und warnt bei Niedrigstand

### 🛠️ System & Monitoring
* **ioBroker-Wächter**:
    * Überwacht Adapter und meldet Ausfälle nach einer Wartezeit (`adapter_off.js`)
    * Implementiert einen PIN-Schutz für sensible VIS-Views (`vis_PIN.js`)
* **Netzwerk-Management**:
    * Überwacht die WAN-IP auf Wechsel, steuert DDNS-Updates und managt Failover-Szenarien (`failover_dyndns_master.js`)
* **Proxmox Cluster Master-Wächter**: Überwachung von Temperatur, Festplatten & Status - sendet Alarme an ALLE Telegram-User und gotify.
* **Fußball-Bundesliga**: Darstellung der aktuellen Tabelle und der nächsten Spiele SGE und FCB mit dem OpenLigaDB-Adapter

### 📺🎵 Medien
* **Medienauswahl**: Wird per Sprachbefehl und Google Home gesteuert
* **Sauna**: Erkennt, wenn die Sauna läuft/nicht läuft und steuert zeitabhängig die Musikausgabe in Bad und Sauna

---

## 🚀 Workflow & Synchronisation
Die Verwaltung der Skripte erfolgt getrennt nach Entwicklung (VS Code) und Laufzeit (ioBroker).

* **Source of Truth**: Die primäre Entwicklungsumgebung ist **VS Code** auf dem lokalen Rechner.
* **Git-Status auf dem Server und auf GitHub**
* **Deployment (Live schalten)**: Die Übertragung zum ioBroker erfolgt manuell über die ioBroker-Extension.

### Täglicher Workflow
1. **Editieren**: Änderungen direkt in VS Code vornehmen
2. **Aktivieren**: Den Upload-Pfeil in der ioBroker-Seitenleiste nutzen
3. **Sichern**: Commit & Push & GitHub Sync in VS Code

---

## ⚙️ Setup
* ioBroker mit installiertem JavaScript-Adapter
* VS Code mit der **ioBroker Extension*.
* Git & GitLens zur Versionsverwaltun.

---

## 📜 Annex: Repository-Standard
1. **Dateiberechtigungen**: Alle Dateien auf dem Server gehören zwingend dem User `iobroker`.
2. **Sauberkeit**: Das Repository wird frei von temporären Systemdateien gehalten.
3. **Source of Truth**: Bei Unstimmigkeiten ist der Stand in VS Code maßgeblich.

---

## 📝 Changelog

Alle wichtigen Änderungen dieses Projekts werden hier dokumentiert.

### [1.9.10] - 2026-04-18
- Update von device_not_available.js

### [1.9.8] - 2026-04-18
- Update von raumwerte_lueften.js (Sayit in Lüftungsskript wieder aktiviert)

### [1.9.4] - 2026-04-16
- Update von location_and_status.js (Location Google Maps anstatt Open Map)

### [1.9.2] - 2026-04-14
- Update von sayit_autofix.js

### [1.9.1] - 2026-04-14
- Update von Auswertung_guenstigste_Tankstelle.js (del)
- Update von guenstige_Tankstelle.js (del)
- Update von telegram_menue.js (del Sprit)

### [1.8.1] - 2026-04-11
- Update von charge_master.js (debounce 45s after change "Charching")

### [1.7.10] - 2026-04-09
- Code-Optimierungen und Updates

### [1.7.9] - 2026-04-09
- Code-Optimierungen und Updates

### [1.7.7] - 2026-04-09
- Update von smartphones_laden.js (Kiki 35-80 %)

### [1.7.5] - 2026-04-07
- R2Mäh2 spricht wieder

### [1.7.3] - 2026-04-05
- Update von heizung_anwesenheit_master.js

### [1.7.2] - 2026-04-04
- Update von smartphones_laden.js (Anwesenheitskriterium entfernt, da zu viel Pflegeaufwand)

### [1.7.1] - 2026-04-04
- Update von heizung_anwesenheit_master.js (Standardprofil von 3 auf 1 geändert)

### [1.6.4] - 2026-03-31
- Update von anwesenheit_unifi.js (Anwesenheit um Thomas_6G erweitert)

### [1.6.3] - 2026-03-24
- Update von batterie_voll.js (Emojis werden nicht mehr ausgesprochen)

### [1.6.1] - 2026-03-23
- Update von charge_master.js (Überschussladen wenn Wallbox "Finishing")

### [1.5.6] - 2026-03-21
- Update von trockner.js
- Update von waschmaschine.js

### [1.5.4] - 2026-03-16
- Update von chromecast_ban_heos.js

### [1.5.3] - 2026-03-16
- Update von batterie_voll.js (zurück auf 100%)

### [1.5.2] - 2026-03-16
- Update von energiemaster_und_sauna.js (Datenpunkte funktional angepasst)

### [1.5.1] - 2026-03-16
- Update von energiemaster_und_sauna.js (Schwellenwert Sauna auf 7.500 Watt angehoben)

### [1.4.1] - 2026-03-16
- Update von trockner.js (weg von alias)
- Update von waschmaschine.js (weg von alias)
- Update von climate_control.js (temp. Änderung)
- Update von batterie_voll.js (ab März auf 30%)
- Update von march_minsoc.js

### [1.3.7] - 2026-03-14
- Update von waschmaschine.js

### [1.3.6] - 2026-03-14
- Update von vis_PIN.js
- PIN wird nicht mehr im Skript angezeigt, neue Datenstruktur unter 0_userdata.0

### [1.3.4] - 2026-03-13
- Update von batterie_voll.js
- zurück auf 100 %, Optimierung und Kommentierung verbessert

### [1.3.3] - 2026-03-13
- Update von charge_master.js
- ursprünglicher MinSoc der Hausbatterie, wenn das Kfz geladen ist

### [1.3.1] - 2026-03-12
- Update von charge_master.js
- Schutz der Hausbatterie bei manuellem Laden (kein Batteriestrom ins Kfz)

### [1.2.5] - 2026-03-11
- Update von kachelofen_ventilator.js

### [1.2.4] - 2026-03-10 Syntax - Skripte mit Prettier Code Formatter aktualisiert
- sehen jetzt schick aus

### [1.2.3] - 2026-03-09
- Update von charge_master.js (Ergänzung der Minutenansage)

### [1.1.1] - 2026-03-08
- Code-Optimierungen und Updates

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
