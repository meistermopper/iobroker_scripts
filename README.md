<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">
# ioBroker Script Collection

![Environment](https://img.shields.io/badge/Environment-ioBroker-orange?style=flat-square)
![Editor](https://img.shields.io/badge/Editor-VS%20Code-blueviolet?style=flat-square)
![Version](https://img.shields.io/badge/Version-2.0.59-success?style=flat-square)

This repository contains my personal collection of automation scripts for ioBroker. These scripts control various aspects of my smart home, from energy optimization to room-specific controls.
## 📂 Structure
The scripts are logically organized by rooms and functions:

### ⚡ Energy & Charging
* **EV Charging Master (`charge_master.js`)**: Manages focused start/stop for Kia EV3 charging based on PV surplus or manual input. Includes battery protection for the house battery during manual charging, robust stop mechanisms for hanging wallbox states, connection monitoring, and intelligent wallbox resets to ensure reliable charging. Optimizes time formatting, kilometer calculation, and provides detailed statistics.
* **Harvia Sauna Control (`Fenix_FX110C_Sauna_control.js`)**: Provides full remote control of the Harvia Fenix FX 110C sauna, including heating, lighting, and temperature settings via REST API. Features robust token management, error handling, and real-time status monitoring.
* **Smart Charging (`fully_smart_laden.js`, `smartphones_laden.js`)**: Intelligent charging control for wall-mounted tablets and smartphones to protect battery life (e.g., 30-70% strategy) and manage automatic display shutdown. Includes self-healing data points, smart notifications, and voice control triggers.
* **Solar Forecast**: Visualizes today's and tomorrow's solar energy production values.
* **UPS Management**: Secures and restores the state of lights and sockets after a power outage (`hue_zigbee_states_restore.js`).

### 💡 Light & Presence
* **Room Logic**: Presence and brightness-dependent lighting control for various areas:
    * **Lower Bathroom**: Scenes for morning and standard lighting with dimming pre-warning (`licht_bewegung_dunkel.js`).
    * **Wardrobe (`garderobenlicht.js`)**: Simple "Presence Follower" logic, ensuring lights efficiently match the state of the presence detector.
    * **Kitchen**: Day and night modes with staggered switching of spots and Hue lamps (`licht_presence.js`).
    * **Living Room**: Brightness and media-dependent lighting control.

### 🏡 Home & Outdoor
* **Mailbox Monitor (`post_da.js`)**: Notifies upon mail delivery with voice announcements and updates VIS status. Prevents duplicate notifications and handles day/night modes for announcements.
* **Robotic Mower Control (R2Mäh2) (`zustand_r2maeh2.js`)**: Monitors mower status via power consumption, sends notifications (start, end, issues, frost warning), performs voice announcements, and calculates daily statistics and electricity costs.
* **Bathroom Dehumidification (`heizen_rh.js`)**: Controls underfloor heating in the bathroom to reduce humidity after showering (mold prevention). Activates heating to 24°C when humidity rises, with window protection and automatic reset to previous or default temperatures.
* **Waste Collection Notification**: Announces and visualizes the next day's waste collection type via voice and message at 6:00 PM the day before.
* **Ventilation Recommendations**: Based on indoor and outdoor temperature and humidity.
* **Fuel Prices**: Evaluates the cheapest gas station nearby and visualizes it.
* **Alarm Detectors**: Acoustic and message-based smoke and water warnings.
* **Household Appliances**: Status messages for washing machine, dishwasher, and dryer.
* **Presence Detection**: Via smartphones using WLAN (UniFi Network Adapter).
* **Heating Control**: Depending on presence.
* **Homematic Service Center**: Monitors UNREACH, LOWBAT, CONFIG_PENDING, and CCU firmware.
* **Battery Levels**: Monitors all battery-powered devices and warns when levels are low.

### 🛠️ System & Monitoring
* **ioBroker Watchdog**:
    * Monitors adapters and reports failures after a waiting period (`adapter_off.js`).
    * Implements PIN protection for sensitive VIS views (`vis_PIN.js`).
    * **SayIt AutoFix (`sayit_autofix.js`)**: Proactively monitors and reactively repairs the SayIt adapter's cache symlink, ensuring persistent voice output functionality and preventing 'ENOENT' errors.
* **Network Management**:
    * Monitors WAN IP for changes, controls DDNS updates, and manages failover scenarios (`failover_dyndns_master.js`).
* **Proxmox Cluster Master Watchdog**: Monitors temperature, hard drives & status - sends alarms to ALL Telegram users and Gotify.
* **Football Bundesliga**: Displays the current table and upcoming matches for SGE and FCB using the OpenLigaDB adapter.

### 📺🎵 Media
* **Media Selection**: Controlled via voice command and Google Home.
* **Ziegenhain Navigation Broadcast (`ziegenhain.js`)**: Triggers a humorous voice announcement across all active SayIt instances in the house in response to a specific voice command.

---

## 🚀 Workflow & Synchronization
Script management is separated between development (VS Code) and runtime (ioBroker).

* **Source of Truth**: The primary development environment is **VS Code** on the local machine.
* **Git Status**: Maintained on the server and GitHub.
* **Deployment (Go Live)**: Transfer to ioBroker is done manually via the ioBroker Extension.

### Daily Workflow
1. **Edit**: Make changes directly in VS Code.
2. **Activate**: Use the upload arrow in the ioBroker sidebar.
3. **Save**: Commit & Push & GitHub Sync in VS Code.

---

## ⚙️ Setup
* ioBroker
* VS Code with the **ioBroker Extension**.
* Git & GitLens for version control.

---

## 📜 Annex: Repository Standards
1. **File Permissions**: All files on the server must belong to the `iobroker` user.
2. **Cleanliness**: The repository is kept free of temporary system files.
3. **Source of Truth**: In case of discrepancies, the state in VS Code is authoritative.

---

## 📝 Changelog

### [2.0.59] - 2026-06-16
- Code optimizations and updates

### [2.0.58] - 2026-06-16
- feat(fully-browser): Enable dim screen activation on motion in night mode (fully_bewegung.js)
- Update of fully_bewegung.js

### [2.0.57] - 2026-06-16
- Code optimizations and updates

### [2.0.56] - 2026-06-16
- fix(sauna-control): Enforce door safety for remote start (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.55] - 2026-06-15
- Code optimizations and updates

### [2.0.54] - 2026-06-15
- fix(sauna-control): Prioritize actual remote ready states (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.53] - 2026-06-15
- Code optimizations and updates

### [2.0.52] - 2026-06-15
- feat(sauna): Add target temperature reached notification (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.51] - 2026-06-15
- Code optimizations and updates

### [2.0.50] - 2026-06-15
- feat(sauna): Add 10-minute pre-heating notification (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.49] - 2026-06-09
- Code optimizations and updates

### [2.0.48] - 2026-06-09
- fix(zustand_r2maeh2): Always reset mower return status cleanly (zustand_r2maeh2.js)
- Update of zustand_r2maeh2.js

### [2.0.47] - 2026-06-08
- Code optimizations and updates

### [2.0.46] - 2026-06-08
- fix(zustand_r2maeh2): Correctly filter power states for hardware changes (zustand_r2maeh2.js)
- Update of zustand_r2maeh2.js

### [2.0.45] - 2026-06-07
- Code optimizations and updates

### [2.0.44] - 2026-06-07
- refactor(sauna): Extend API parsing and refine boolean state normalization (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.43] - 2026-06-07
- Code optimizations and updates

### [2.0.42] - 2026-06-07
- refactor(sauna): Improve API data parsing and state normalization (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.40] - 2026-06-02
- refactor(notify): Remove custom titles from global notifications (heizen_rh.js, heizen_rh.js, post_da.js, ziegenhain.js, fully_smart_laden.js, smartphones_laden.js)

### [2.0.38] - 2026-06-02
- chore(sauna): Update preferred radio sender (session_master.js)

### [2.0.36] - 2026-06-01
- refactor(bad-radio): Unify control and adjust volume dynamically by sauna state (radio.js, session_master.js)

### [2.0.27] - 2026-05-29
- feat(sauna-radio): Unify radio and light control for sauna and bath (Fenix_FX110C_Sauna_control.js, radio_master.js, session_master.js)

### [2.0.25] - 2026-05-29
- fix(notify): Sanitize text for voice announcements (zustand_r2maeh2.js, energiemaster_und_sauna.js, notify.js)

### [2.0.23] - 2026-05-28
- change alert prio (batterie_wechseln.js, usv_wartung_apc_server.js, notify.js)

### [2.0.21] - 2026-05-28
- changes (notify.js)
- Update of notify.js

### [2.0.13] - 2026-05-28
- Updated changelog and translated notifications in scripts to English; removed obsolete notification function in heos_offline.js (heos_offline.js, auto_version.js)

### [2.0.10] - 2026-05-28
- Added new station 'Jazz Loft' and removed obsolete scripts for sauna automation (radio.js, radio_auto.js, radio_manuell.js, radio_master.js)

### [2.0.7] - 2026-05-28
- Set default volume for radio senders and remove obsolete google_utils.js (radio.js, google_utils.js)

### [2.0.1] - 2026-05-27
- Refactored notification system to use centralized global notify function (heizen_rh.js, radio.js, muellmeldung.js, post_da.js, zustand_r2maeh2.js, Wasserdruckwarnung.js, alarmmelder.js, playerstate.js, vu_reboot_standby.js, energiemaster_und_sauna.js, script_verwaltung.js, ziegenhain.js, ap_management.js, dyndns_fail.js, failover_dyndns_master.js, neue_ip_failover.js, usv_wartung_eaton_buero.js, device_not_available.js, radio_heos.js, video_auto_aus.js, fully_smart_laden.js, smartphones_laden.js, google_utils.js, notify.js)

### [1.22.7] - 2026-05-27
- Updated changelog and added whitelist for device IDs in Chromecast adapter (muellmeldung.js, post_da.js, zustand_r2maeh2.js, chromecast_ban_heos.js)

### [1.22.1] - 2026-05-26
- Following new UDM Pro firmware v5.1.12, the Chromecast adapter flooded the log with non-responding HEOS devices.
- Updated HEOS filter: Removed outdated device names, added delay helper function, and improved state checks. Updated version to 1.22.0. (chromecast_ban_heos.js)

### [1.21.53] - 2026-05-26
- Code optimizations and updates

### [1.21.51] - 2026-05-26
- Updated HEOS filter: Added additional banned device names and IDs, improved name checks, and reduced wait time before deletion (chromecast_ban_heos.js)

### [1.21.47] - 2026-05-25
- Updated notification text for full battery storage in batterie_voll.js (batterie_voll.js)

### [1.21.44] - 2026-05-25
- Updated changelog and translated notifications in charge_master.js into English (charge_master.js)

### [1.21.42] - 2026-05-25
- Repaired alias targets in evening light scripts and adjusted data types for Google Home (abendlicht_TV_Wind_aus.js, switch_abendlicht.js)

### [1.21.40] - 2026-05-25
- Added constant for WiFi reconnect delay (charge_master.js)

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
