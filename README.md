<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">
# ioBroker Skript-Sammlung

![Umgebung](https://img.shields.io/badge/Umgebung-ioBroker-orange?style=flat-square)
![Zentrale](https://img.shields.io/badge/Editor-VS%20Code-blueviolet?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.21.30-success?style=flat-square)

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

### [1.21.30] - 2026-05-24
- Code-Optimierungen und Updates

### [1.21.29] - 2026-05-24
- Aktualisiere README und entferne veraltete Changelog-Einträge; verbessere Kommentare und Übersetzungen in charge_master.js (charge_master.js)
- Update von charge_master.js

### [1.21.25] - 2026-05-24
- Added robust charging stop mechanism and improved error handling for "hanging" wallbox status (charge_master.js)

### [1.21.11] - 2026-05-23
- Updated update_readme_changelog.js (Versioning has been optimized)

### [1.21.10] - 2026-05-23
- Updated zustand_r2maeh2.js (Script optimizations have been implemented)

### [1.21.6] - 2026-05-23
- Updated chromecast_ban_heos.js (Hardened device naming)

### [1.21.1] - 2026-05-22
- Updated Fenix_FX110C_Sauna_control.js (Added data point Sauna heating active)
- Updated energiemaster_und_sauna.js

### [1.20.19] - 2026-05-20
- Updated Fenix_FX110C_Sauna_control.js (Improvements in log)

### [1.20.16] - 2026-05-18
- Updated Fenix_FX110C_Sauna_control.js (Modified oven power reference)

### [1.20.14] - 2026-05-18
- Updated Fenix_FX110C_Sauna_control.js (string to boolean)

### [1.20.11] - 2026-05-18 (Switched Gotify to httpPost instead of curl)
- Updated post_da.js
- Updated charge_master.js
- Updated script_verwaltung.js
- Updated homematic_all.js
- Updated ap_management.js
- Updated dyndns_fail.js
- Updated neue_ip_failover.js
- Updated smartphones_laden.js

### [1.20.9] - 2026-05-18
- Updated charge_master.js (Timeout extended)

### [1.20.3] - 2026-05-17
- Updated Fenix_FX110C_Sauna_control.js (Fenix is now controllable!)

### [1.19.30] - 2026-05-16
- Updated charge_master.js (Reduced log output)

### [1.19.19] - 2026-05-14
- Updated Fenix_FX110C_Sauna_control.js (Added fallback URL for Harvia)

### [1.19.17] - 2026-05-14
- Updated chromecast_ban_heos.js (Heos name adjustments)

### [1.19.15] - 2026-05-13
- Updated charge_master.js (Suppressed log flood when vehicle not plugged in)

### [1.19.13] - 2026-05-12
- Updated heizen_rh.js (Upstairs and downstairs bathroom - Race condition caught (window/thermostat))

### [1.19.11] - 2026-05-10
- Updated chromecast_ban_heos.js (Adjusted Heos names)

### [1.17.9] - 2026-05-04
- Updated Fenix_FX110C_Sauna_control.js (Back to monitoring after test)

### [1.17.6] - 2026-05-03
- Updated zustand_r2maeh2.js (Added error-warnings (stuck))
- Updated r2maeh2.js (deleted)

### [1.17.4] - 2026-05-03
- Updated zustand_r2maeh2.js (Added average costs)

### [1.17.1] - 2026-05-02
- Updated charge_master.js (Implemented more intelligent smoothing)

### [1.16.1] - 2026-05-02
- Updated charge_master.js (Adjusted data points)

### [1.13.7] - 2026-05-02
- Updated failover_dyndns_master.js (Extended timeout for Amazon IP query to 10s)

### [1.13.3] - 2026-05-01
- Updated chromecast_ban_heos.js (Also delete devices that were entered incorrectly)

### [1.13.1] - 2026-05-01
- Updated charge_master.js (Intelligent wallbox reset before each charging process to fix startup issues.)

### [1.12.3] - 2026-04-29
- Updated chromecast_ban_heos.js (Extended to all devices)

### [1.12.1] - 2026-04-28
- charge-master.js (No charging start if charging target reached)

### [1.11.1] - 2026-04-24
- Fenix sauna implemented

### [1.10.11] - 2026-04-23
- Updated sayit_autofix.js

### [1.10.3] - 2026-04-23
- Updated sayit_autofix.js (Stricter monitoring)

### [1.10.1] - 2026-04-22
- Updated charge_master.js (Improved charging range and reliability)

### [1.9.10] - 2026-04-18
- Updated device_not_available.js (Report Zigbee failure only after 15 minutes)

### [1.9.8] - 2026-04-18
- Updated raumwerte_lueften.js (Sayit reactivated in ventilation script)

### [1.9.4] - 2026-04-16
- Updated location_and_status.js (Location Google Maps instead of Open Map)

### [1.9.2] - 2026-04-14
- Updated sayit_autofix.js

### [1.9.1] - 2026-04-14
- Updated Auswertung_guenstigste_Tankstelle.js (del)
- Updated guenstige_Tankstelle.js (del)
- Updated telegram_menue.js (del Fuel)

### [1.8.1] - 2026-04-11
- Updated charge_master.js (Debounce 45s after change "Charging")

### [1.7.7] - 2026-04-09
- Updated smartphones_laden.js (Kiki 35-80%)

### [1.7.5] - 2026-04-07
- R2Mäh2 speaks again

### [1.7.3] - 2026-04-05
- Updated heizung_anwesenheit_master.js

### [1.7.2] - 2026-04-04
- Updated smartphones_laden.js (Presence criterion removed due to high maintenance effort)

### [1.7.1] - 2026-04-04
- Updated heizung_anwesenheit_master.js (Changed default profile from 3 to 1)

### [1.6.4] - 2026-03-31
- Updated anwesenheit_unifi.js (Presence extended by Thomas_6G)

### [1.6.3] - 2026-03-24
- Updated batterie_voll.js (Emojis are no longer spoken)

### [1.6.1] - 2026-03-23
- Updated charge_master.js (Excess charging when wallbox "Finishing")

### [1.5.6] - 2026-03-21
- Updated trockner.js
- Updated waschmaschine.js

### [1.5.4] - 2026-03-16
- Updated chromecast_ban_heos.js

### [1.5.3] - 2026-03-16
- Updated batterie_voll.js (Back to 100%)

### [1.5.2] - 2026-03-16
- Updated energiemaster_und_sauna.js (Data points functionally adjusted)

### [1.5.1] - 2026-03-16
- Updated energiemaster_und_sauna.js (Sauna threshold raised to 7,500 watts)

### [1.4.1] - 2026-03-16
- Updated trockner.js (Removed alias)
- Updated waschmaschine.js (Removed alias)
- Updated climate_control.js (Temp. change)
- Updated batterie_voll.js (From March to 30%)
- Updated march_minsoc.js

### [1.3.7] - 2026-03-14
- Updated waschmaschine.js

### [1.3.6] - 2026-03-14
- Updated vis_PIN.js
- PIN is no longer displayed in the script, new data structure under 0_userdata.0

### [1.3.4] - 2026-03-13
- Updated batterie_voll.js
- Back to 100%, optimization and commenting improved

### [1.3.3] - 2026-03-13
- Updated charge_master.js
- Original MinSoc of house battery when vehicle is charged

### [1.3.1] - 2026-03-12
- Updated charge_master.js
- Protection of the house battery during manual charging (no battery power to the vehicle)

### [1.2.5] - 2026-03-11
- Updated kachelofen_ventilator.js

### [1.2.4] - 2026-03-10 Syntax - Skripte mit Prettier Code Formatter aktualisiert
- Scripts updated with Prettier Code Formatter
- Now look neat

### [1.2.3] - 2026-03-09
- Updated charge_master.js (Added minute announcement)

### [1.0.12] - 2026-03-08
- Updated fenster_offen.js
- Updated trockner.js
- Updated waschmaschine.js
- Updated vu_reboot_standby.js
- Updated auto_version.js

### [1.0.7] - 2026-03-08
- Documentation and scripts updated

### [1.0.1] - 2026-03-08
- Current scripts and automatic versioning initiated

---
*Note: This is a private project.*
