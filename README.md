<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">
# ioBroker Script Collection

![Environment](https://img.shields.io/badge/Environment-ioBroker-orange?style=flat-square)
![Editor](https://img.shields.io/badge/Editor-VS%20Code-blueviolet?style=flat-square)
![Version](https://img.shields.io/badge/Version-2.2.3-success?style=flat-square)

This repository contains my personal collection of automation scripts for ioBroker. These scripts control various aspects of my smart home, from energy optimization to room-specific controls.

## 📂 Structure

The scripts are logically organized by rooms and functions:

### ⚡ Energy & Charging

- **EV Charging Master (`charge_master.js`)**: Manages focused start/stop for Kia EV3 charging based on PV surplus or manual input. Includes battery protection for the house battery during manual charging, robust stop mechanisms for hanging wallbox states, connection monitoring, and intelligent wallbox resets to ensure reliable charging. Optimizes time formatting, kilometer calculation, and provides detailed statistics.
- **Harvia Sauna Control (`Fenix_FX110C_Sauna_control.js`)**: Provides full remote control of the Harvia Fenix FX 110C sauna, including heating, lighting, and temperature settings via REST API. Features robust token management, error handling, and real-time status monitoring.
- **Smart Charging (`fully_smart_laden.js`, `smartphones_laden.js`)**: Intelligent charging control for wall-mounted tablets and smartphones to protect battery life (e.g., 30-70% strategy) and manage automatic display shutdown. Includes self-healing data points, smart notifications, and voice control triggers.
- **Solar Forecast**: Visualizes today's and tomorrow's solar energy production values.
- **UPS Management**: Secures and restores the state of lights and sockets after a power outage (`hue_zigbee_states_restore.js`).

### 💡 Light & Presence

- **Room Logic**: Presence and brightness-dependent lighting control for various areas:
  - **Lower Bathroom**: Scenes for morning and standard lighting with dimming pre-warning (`licht_bewegung_dunkel.js`).
  - **Wardrobe (`garderobenlicht.js`)**: Simple "Presence Follower" logic, ensuring lights efficiently match the state of the presence detector.
  - **Kitchen**: Day and night modes with staggered switching of spots and Hue lamps (`licht_presence.js`).
  - **Living Room**: Brightness and media-dependent lighting control.

### 🏡 Home & Outdoor

- **Mailbox Monitor (`post_da.js`)**: Notifies upon mail delivery with voice announcements and updates VIS status. Prevents duplicate notifications and handles day/night modes for announcements.
- **Robotic Mower Control (R2Mäh2) (`zustand_r2maeh2.js`)**: Monitors mower status via power consumption, sends notifications (start, end, issues, frost warning), performs voice announcements, and calculates daily statistics and electricity costs.
- **Bathroom Dehumidification (`heizen_rh.js`)**: Controls underfloor heating in the bathroom to reduce humidity after showering (mold prevention). Activates heating to 24°C when humidity rises, with window protection and automatic reset to previous or default temperatures.
- **Waste Collection Notification**: Announces and visualizes the next day's waste collection type via voice and message at 6:00 PM the day before.
- **Ventilation Recommendations**: Based on indoor and outdoor temperature and humidity.
- **Fuel Prices**: Evaluates the cheapest gas station nearby and visualizes it.
- **Alarm Detectors**: Acoustic and message-based smoke and water warnings.
- **Household Appliances**: Status messages for washing machine, dishwasher, and dryer.
- **Presence Detection**: Via smartphones using WLAN (UniFi Network Adapter).
- **Heating Control**: Depending on presence.
- **Homematic Service Center**: Monitors UNREACH, LOWBAT, CONFIG_PENDING, and CCU firmware.
- **Battery Levels**: Monitors all battery-powered devices and warns when levels are low.

### 🛠️ System & Monitoring

- **ioBroker Watchdog**:
  - Monitors adapters and reports failures after a waiting period (`adapter_off.js`).
  - Implements PIN protection for sensitive VIS views (`vis_PIN.js`).
  - **SayIt AutoFix (`sayit_autofix.js`)**: Proactively monitors and reactively repairs the SayIt adapter's cache symlink, ensuring persistent voice output functionality and preventing 'ENOENT' errors.
- **Network Management**:
  - Monitors WAN IP for changes, controls DDNS updates, and manages failover scenarios (`failover_dyndns_master.js`).
- **Proxmox Cluster Master Watchdog**: Monitors temperature, hard drives & status - sends alarms to ALL Telegram users and Gotify.
- **Football Bundesliga**: Displays the current table and upcoming matches for SGE and FCB using the OpenLigaDB adapter.

### 📺🎵 Media

- **Media Selection**: Controlled via voice command and Google Home.
- **Ziegenhain Navigation Broadcast (`ziegenhain.js`)**: Triggers a humorous voice announcement across all active SayIt instances in the house in response to a specific voice command.

---

## 🚀 Workflow & Synchronization

Script management is separated between development (VS Code) and runtime (ioBroker).

- **Source of Truth**: The primary development environment is **VS Code** on the local machine.
- **Git Status**: Maintained on the server and GitHub.
- **Deployment (Go Live)**: Transfer to ioBroker is done manually via the ioBroker Extension.

### Daily Workflow

1. **Edit**: Make changes directly in VS Code.
2. **Activate**: Use the upload arrow in the ioBroker sidebar.
3. **Save**: Commit & Push & GitHub Sync in VS Code.

---

## ⚙️ Setup

- ioBroker
- VS Code with the **ioBroker Extension**.
- Git & GitLens for version control.

---

## 📜 Annex: Repository Standards

1. **File Permissions**: All files on the server must belong to the `iobroker` user.
2. **Cleanliness**: The repository is kept free of temporary system files.
3. **Source of Truth**: In case of discrepancies, the state in VS Code is authoritative.

---

## 📝 Changelog

### [2.2.3] - 2026-06-29
- feat: add monitoring scripts for NUT client connectivity and Sonoff MQTT availability with alert notifications (sonoff_fail.js, nut_client_inactive.js)

### [2.2.2] - 2026-06-29
- feat: add set of smarthome automation, monitoring, and utility scripts for ioBroker (Weihnachtsbaum_Terrasse.js, geschirr.js, trockner.js, waschmaschine.js, heos_offline.js, batterie_voll.js, batteriehitzewarnung.js, soh_change.js, stromausfall.js, fritz_reboot.js, astrozeiten.js, adapter_off.js, battery_states.js, raumwerte_lueften.js, sonoff_fail.js, tasmota_fw.js, nut_client_inactive.js, telegram_menue.js, sat_tv_auto_aus.js, abendlicht_TV_Wind_aus.js, autolicht_daemmer.js, kachelofen_ventilator.js)

### [2.2.1] - 2026-06-29

- feat: add comprehensive library of iobroker automation scripts across home and system domains (heizen_rh.js, licht_bewegung_dunkel.js, heizen_rh.js, licht_bewegung_dunkel.js, radio.js, Anrufer.js, BWM_test.js, Bewegungsmelder_Test.js, Feuchte_Funktion.js, Fruehansage_kueche.js, Garderobenlicht_Schalter.js, Garderobenlicht_nonpresence.js, IFTTT.js, Licht_schalten.js, Ort_nach_Koordinaten.js, Radio_Status_abfragen.js, Standort_Kfz_telegram.js, TV_Sender_Wozi.js, VU_Sender_GH.js, Waschmaschine_Kosten.js, Zufallslicht_Funktionen.js, function_einbinden.js, geo_api.js, gotify_exec.js, ip_ddnss_ipv4.js, prox_telegram.js, tablet_smar_laden.js, test2.js, unify_voucher.js, zaehlerstand.js, deckenlampe_auto_aus.js, Weihnachtsbaum_Terrasse.js, muellmeldung.js, post_da.js, zustand_r2maeh2.js, tageskosten.js, fenster_offen.js, garderobenlicht.js, geschirr.js, morgenprogramm.js, trockner.js, licht.js, boiler.js, licht_presence.js, Fenix_FX110C_Sauna_control.js, heos_offline.js, session_master.js, playerstate.js, schranklicht.js, vu_reboot_standby.js, werte_schreiben_silvester.js, serverschrank_taegl.js, weinklima_taegl.js, heizung_anwesenheit_master.js, charge_master.js, climate_control.js, location_and_status.js, batterie_voll.js, batteriehitzewarnung.js, energiemaster_und_sauna.js, march_minsoc.js, soh_change.js, stromausfall.js, fritz_reboot.js, homematic_all.js, astrozeiten.js, weihnachtszeit.js, zeiten.js, adapter_off.js, chromecast_ban_heos.js, raumwerte_lueften.js, sonoff_devices_table.js, sonoff_fail.js, tasmota_fw.js, vis_PIN.js, percent_blocking_both.js, proxmox_master_v2.js, ram_monitor.js, dyndns_fail.js, failover_dyndns_master.js, neue_ip_failover.js, hue_zigbee_states_restore.js, nut_client_inactive.js, usv_wartung_apc_server.js, usv_wartung_eaton_buero.js, telegram_menue.js, termine_2T.js, sat_tv_auto_aus.js, marantz_laeuft.js, radio_heos.js, radio_manuell.js, video_auto_aus.js, abendlicht_TV_Wind_aus.js, autolicht_daemmer.js, baum_Zeitschalt.js, musiklicht.js, ventilator_false.js, videolicht.js, fully_smart_laden.js, ladestation_neustart_hub.js, smartphones_laden.js, verbrauch_media.js, kachelofen_ventilator.js, notify.js)

### [2.1.1] - 2026-06-29

- feat: add UniFi presence monitoring script with configurable debouncing and notifications (anwesenheit_unifi.js)

### [2.0.87] - 2026-06-29

- Update of playerstate.js
- Update of jsconfig.json

Older entries can be found in the [Changelog Archive](CHANGELOG_OLD.md).

---

_Note: This is a private project._
