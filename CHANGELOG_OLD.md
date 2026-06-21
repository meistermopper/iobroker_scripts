# Changelog Archive

This archive contains older changelog entries for the ioBroker Script Collection.

---

### [2.0.68] - 2026-06-20
- feat: implement sensor alarm monitoring script with rate limiting and global notifications (alarmmelder.js)
- Update of alarmmelder.js

### [2.0.67] - 2026-06-20
- Update of .iobroker-config.json

### [2.0.66] - 2026-06-20
- Update of .iobroker-config.json

### [2.0.64] - 2026-06-20
- refactor(r2maeh2): Correct device name spelling in notifications (zustand_r2maeh2.js)
- Update of zustand_r2maeh2.js

### [2.0.62] - 2026-06-20
- refactor(r2maeh2): Update device name in notifications (zustand_r2maeh2.js)
- Update of zustand_r2maeh2.js

### [2.0.60] - 2026-06-16
- fix(r2maeh2): Extend max mowing time and refine notifications (zustand_r2maeh2.js)
- Update of zustand_r2maeh2.js

### [2.0.58] - 2026-06-16
- feat(fully-browser): Enable dim screen activation on motion in night mode (fully_bewegung.js)
- Update of fully_bewegung.js

### [2.0.56] - 2026-06-16
- fix(sauna-control): Enforce door safety for remote start (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.54] - 2026-06-15
- fix(sauna-control): Prioritize actual remote ready states (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.52] - 2026-06-15
- feat(sauna): Add target temperature reached notification (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.50] - 2026-06-15
- feat(sauna): Add 10-minute pre-heating notification (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

### [2.0.48] - 2026-06-09
- fix(zustand_r2maeh2): Always reset mower return status cleanly (zustand_r2maeh2.js)
- Update of zustand_r2maeh2.js

### [2.0.46] - 2026-06-08
- fix(zustand_r2maeh2): Correctly filter power states for hardware changes (zustand_r2maeh2.js)
- Update of zustand_r2maeh2.js

### [2.0.44] - 2026-06-07
- refactor(sauna): Extend API parsing and refine boolean state normalization (Fenix_FX110C_Sauna_control.js)
- Update of Fenix_FX110C_Sauna_control.js

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

### [1.0.1] - 2026-03-08
- Current scripts and automatic versioning initiated
