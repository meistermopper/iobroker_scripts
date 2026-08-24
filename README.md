<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">

[🇩🇪 Deutsche Version](README_de.md)
<img src="media/iobroker.png" align="right" width="100" alt="Projekt Logo">

[🇩🇪 Deutsche Version](README_de.md)

# ioBroker Script Collection

![Environment](https://img.shields.io/badge/Environment-ioBroker-orange?style=flat-square)
![Language - JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=black&style=flat-square)
![Linter - Biome](https://img.shields.io/badge/Linter-Biome-60A5FA?logo=biome&logoColor=white&style=flat-square)
![Editor](https://img.shields.io/badge/Editor-Antigravity%20IDE-blueviolet?style=flat-square)
![Version](https://img.shields.io/badge/Version-3.3.13-success?style=flat-square)

This repository contains my personal collection of automation scripts for ioBroker. These scripts control various aspects of my smart home, from energy optimization to room-specific controls.

## 📂 Structure

The scripts are logically organized by rooms and functions:

### ⚡ Energy & Charging

- **EV Charging Master (`charge_master.js`)**: Manages focused start/stop for Kia EV3 charging based on PV surplus or manual input. Includes battery protection for the house battery during manual charging, robust stop mechanisms for hanging wallbox states, connection monitoring, and intelligent wallbox resets to ensure reliable charging. Optimizes time formatting, kilometer calculation, and provides detailed statistics.
- **Smart Charging (`fully_smart_laden.js`, `smartphones_laden.js`)**: Intelligent charging control for wall-mounted tablets and smartphones to protect battery life (e.g., 30-70% strategy) and manage automatic display shutdown. Includes self-healing data points, smart notifications, and voice control triggers.
- **Solar Forecast (`solarprognose_master.js`)**: Visualizes today's and tomorrow's solar energy production values, tracks daily solar forecast vs. actual statistics, and supports Telegram/Gotify notifications.
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
- **Doorbell & Call Monitor (`anruf_klingel_terrasse.js`)**: Detects incoming phone calls or doorbell rings via the FRITZ!Box TR-064 adapter, announces them via Google Speaker (SayIt) on the terrace with dynamic volume control, dispatches notifications, and flashes the living room lights "Ei" (in blue) and "Kommode" on every doorbell ring.
- **Waste Collection Notification**: Announces and visualizes the next day's waste collection type via voice and message at 6:00 PM the day before.
- **Ventilation Recommendations**: Based on indoor and outdoor temperature and humidity.
- **Alarm Detectors**: Acoustic and message-based smoke, water warnings, and carbon monoxide monitoring for the tile stove (`co_warnung_kachelofen.js`) with loud SayIt voice announcements (100%), Telegram, and Gotify.
- **Household Appliances**: Status messages for washing machine, dishwasher, and dryer with full details sent via Telegram/Gotify and concise voice announcements upon completion.
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
- **DrayTek Vigor 166 Monitor (`connected.js`)**: Starts a local HTTP server to receive Grafana webhook alerts for DSL connection status, setting state values, and notifying via Telegram, Gotify, or Google Speaker.
- **Global Notifications (`notify.js`)**: Centralizes alerts and status messages across the entire smart home, sending messages via Telegram and Gotify, and broadcasting voice announcements with dynamic Chromecast resume logic and support for custom concise voice messages.
- **Telegram Control Center (`telegram_menue.js`)**: Interactive Telegram bot menu for monitoring indoor climate, window statuses, Kia location, appointments, astro times, and quick-toggling outdoor/terrace devices.
- **Football Bundesliga**: Displays the current table and upcoming matches for SGE and FCB using the OpenLigaDB adapter.

### 📺🎵 Media & Sauna

- **Sauna & Audio Master (`session_master.js`)**: Manages HEOS audio playlists and staggered playback in sauna and bathroom during sauna sessions. Integrates with the native `harvia-fenix` adapter (`harvia-fenix.0`) for sauna light synchronization and notifications.
- **Media Selection**: Controlled via voice command and Google Home.
- **Ziegenhain Navigation Broadcast (`ziegenhain.js`)**: Triggers a humorous voice announcement across all active SayIt instances in the house in response to a specific voice command.

---

## 🚀 Workflow & Synchronization

Script management is separated between development (Antigravity IDE) and runtime (ioBroker).

- **Source of Truth**: The primary development environment is **Antigravity IDE** on the local machine.
- **Git Status**: Maintained on the server and GitHub.
- **Deployment (Go Live)**: Transfer to ioBroker is done manually via the ioBroker Extension.

### Daily Workflow

1. **Edit**: Make changes directly in Antigravity IDE.
2. **Activate**: Use the upload arrow in the ioBroker sidebar.
3. **Save**: Commit & Push & GitHub Sync in Antigravity IDE.

---

## ⚙️ Setup

- ioBroker
- Antigravity IDE
- Git & GitLens for version control.

---

## 📜 Annex: Repository Standards

1. **File Permissions**: All files on the server must belong to the `iobroker` user.
2. **Cleanliness**: The repository is kept free of temporary system files.
3. **Source of Truth**: In case of discrepancies, the state in Antigravity IDE is authoritative.

---

## 📝 Changelog

### [3.3.13] - 2026-08-24
- refactor(telegram): Improve chat targeting and data robustness in menu (telegram_menue.js)

### [3.3.12] - 2026-08-24
- refactor(telegram): Add chat ID targeting, null safety for sensors/GPS, and standardize structure (telegram_menue.js)

### [3.3.11] - 2026-08-24
- feat(telegram): Enhance command parsing and add main menu aliases (telegram_menue.js)

### [3.3.10] - 2026-08-20
- feat(kia): Implement dynamic home battery protection during manual EV charging (charge_master.js)

### [3.3.9] - 2026-08-11
- feat(telegram): increase Kia location query timeout to 60 seconds (telegram_menue.js)

Older entries can be found in the [Changelog Archive](CHANGELOG_OLD.md).
