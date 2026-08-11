# Changelog Archive

This archive contains older changelog entries for the ioBroker Script Collection.

---

### [3.3.1] - 2026-08-04

- feat(global): Enhance TTS processing and improve Chromecast watchdog robustness (notify.js)

### [3.2.23] - 2026-08-04

- refactor(scripting): Standardize `on()` trigger ID patterns using regular expressions (adapter_off.js, sonoff_fail.js, nut_client_inactive.js)

### [3.2.22] - 2026-08-04

- refactor(iobroker-battery-states): improve name resolution and add type hint (battery_states.js)

### [3.2.21] - 2026-08-04
- refactor(notifications): Enable HTML parsing for Telegram and standardize message formatting (solarprognose_master.js, adapter_off.js, battery_states.js, failover_dyndns_master.js, notify.js)

### [3.2.20] - 2026-08-03
- feat(pv): Increase solar prognosis daily stats retention to one year (solarprognose_master.js)

### [3.2.19] - 2026-08-03
- refactor(global): Centralize notification handling across scripts (Weihnachtsbaum_Terrasse.js, licht.js, anwesenheit_unifi.js, batterie_voll.js, batteriehitzewarnung.js, soh_change.js, solarprognose_master.js, stromausfall.js, fritz_reboot.js, homematic_all.js, adapter_off.js, battery_states.js, raumwerte_lueften.js, sonoff_fail.js, tasmota_fw.js, nut_client_inactive.js, connected.js, sat_tv_auto_aus.js, abendlicht_TV_Wind_aus.js, autolicht_daemmer.js, kachelofen_ventilator.js)

### [3.2.18] - 2026-08-03
- chore(haushalt): Remove excessive console logs from household device scripts (trockner.js, waschmaschine.js)

### [3.2.17] - 2026-08-03
- refactor(haushalt): use global notify script for dry, wash and dishwasher notifications (geschirr.js, trockner.js, waschmaschine.js)

### [3.2.16] - 2026-08-01
- chore(ai-commit-hook): Enforce English language for generated commit messages (ai-commit-hook.js)

### [3.2.15] - 2026-07-31
- feat(sauna): integrate Harvia Fenix native adapter (energiemaster_und_sauna.js)

### [3.2.14] - 2026-07-27
- refactor(kia): Prevent repetitive OCPP offline warnings and update header (charge_master.js)

### [3.2.13] - 2026-07-27
- feat(pv): Format Telegram/Gotify PV yield notifications to rounded kWh (solarprognose_master.js)

### [3.2.12] - 2026-07-27
- feat(pv): Implement PV yield scaling factor and remove peak power tracking (solarprognose_master.js)

### [3.2.10] - 2026-07-24
- fix(vitrine): Add offline notifications and reachability check for vitrine light (licht.js)

### [3.2.9] - 2026-07-24
- fix(vitrine): Add offline notification (Telegram, Gotify, SayIt) and reachability check in licht.js

### [3.2.8] - 2026-07-24
- fix(vitrine): Ensure vitrine colorloop starts reliably (licht.js)

### [3.2.7] - 2026-07-24
- feat(sauna): Integrate Harvia Fenix adapter and add sauna notifications (session_master.js, switch_abendlicht.js)
- refactor(sauna): Integrate harvia-fenix adapter data points into session_master.js

### [3.2.6] - 2026-07-23
- refactor(global): Introduce and apply state creation and date arithmetic best practices (energiemaster_und_sauna.js, homematic_all.js, kalender.js)

### [3.2.5] - 2026-07-23
- fix(global): Prevent object modification errors and improve creation (homematic_all.js, kalender.js, switch_abendlicht.js)

### [3.2.4] - 2026-07-23
- style(global): Apply consistent code formatting (Fenix_FX110C_Sauna_control.js, setup_secrets.js, ai-commit-hook.js)

### [3.2.3] - 2026-07-23
- feat(lighting): Configure CT states for proper IoT integration and refine object hiding (switch_abendlicht.js)

### [3.2.2] - 2026-07-21
- feat(pihole): Implement Pi-hole blocked queries percentage extraction (percent_blocked.js)

### [3.2.1] - 2026-07-19
- fix(fritzbox): Fix Hue lamp state restoration after visual alert (anruf_klingel_terrasse.js)
- feat(sauna): Switch to harvia-fenix native adapter for sauna control

### [3.1.36] - 2026-07-19
- feat(doorbell): Add visual doorbell alert with living room lights (anruf_klingel_terrasse.js)

### [3.1.35] - 2026-07-18
- refactor(homematic): Use optional chaining for tag_name check (homematic_all.js)

### [3.1.34] - 2026-07-18
- feat(evening-light): Extend legacy HUE state hiding and improve robustness (switch_abendlicht.js)

### [3.1.33] - 2026-07-17
- feat(sauna, smart-home): Implement proactive token refresh and retry logic for sauna control; enhance smartName handling (Fenix_FX110C_Sauna_control.js, switch_abendlicht.js)

### [3.1.32] - 2026-07-16
- fix(evening-light): Improve smart home integration hiding and prevent sync errors (switch_abendlicht.js)

### [3.1.31] - 2026-07-16
- refactor(pihole): Remove redundant Pi-hole blocking percentage script (percent_blocking_both.js)

### [3.1.30] - 2026-07-16
- chore(pihole): Remove Pi-hole unique domains blocked script (domains_blocked.js)

### [3.1.29] - 2026-07-15
- chore(pv): Remove verbose log for missing solar API token (solarprognose_master.js)

### [3.1.28] - 2026-07-14
- refactor(smarthome): Improve script robustness and API token handling (anwesenheit_unifi.js, solarprognose_master.js)

### [3.1.27] - 2026-07-14
- style(global): Introduce ES2022 ESLint environment and update agent docs (heizen_rh.js, licht_bewegung_dunkel.js, radio.js, deckenlampe_auto_aus.js, switch_neu_starten.js, Weihnachtsbaum_Terrasse.js, muellmeldung.js, post_da.js, zustand_r2maeh2.js, Wasserdruckwarnung.js, alarmmelder.js, tageskosten.js, fenster_offen.js, garderobenlicht.js, geschirr.js, morgenprogramm.js, reinigungsmodus.js, trockner.js, waschmaschine.js, licht.js, boiler.js, licht_presence.js, Fenix_FX110C_Sauna_control.js, heos_offline.js, session_master.js, playerstate.js, schranklicht.js, tv_licht.js, vu_reboot_standby.js, werte_schreiben_silvester.js, serverschrank_taegl.js, weinklima_taegl.js, anwesenheit_unifi.js, heizung_anwesenheit_master.js, charge_master.js, climate_control.js, location_and_status.js, batterie_voll.js, batteriehitzewarnung.js, energiemaster_und_sauna.js, march_minsoc.js, soh_change.js, solarprognose_master.js, stromausfall.js, anruf_klingel_terrasse.js, fritz_reboot.js, homematic_all.js, astrozeiten.js, kalender.js, mond_zunehmend_abnehmend.js, weihnachtszeit.js, wochentage.js, zeiten.js, adapter_off.js, battery_states.js, chromecast_ban_heos.js, iobroker_restart.js, miele_restart.js, raumwerte_lueften.js, sayit_autofix.js, setup_secrets.js, sonoff_devices_table.js, sonoff_fail.js, syslog_monitor.js, tasmota_fw.js, vaillant_Neustart.js, versionen.js, vis_PIN.js, ziegenhain.js, percent_blocking_both.js, proxmox_master_v2.js, iobroker_error.js, ram_monitor.js, ap_management.js, failover_dyndns_master.js, network_version.js, batterie_wechseln.js, hue_zigbee_states_restore.js, nut_client_inactive.js, usv_wartung_apc_server.js, usv_wartung_eaton_buero.js, connected.js, device_not_available.js, telegram_menue.js, termine_2T.js, bedienung.js, sat_tv_auto_aus.js, denon_surr_manager.js, marantz_laeuft.js, radio_heos.js, video_auto_aus.js, abendlicht_TV_Wind_aus.js, autolicht_daemmer.js, baum_Zeitschalt.js, musiklicht.js, switch_abendlicht.js, switch_alle_lampen.js, switch_ventilatorlicht.js, ventilator_false.js, videolicht.js, clear_cache.js, fully_bewegung.js, fully_smart_laden.js, ladestation_neustart_hub.js, smartphones_laden.js, verbrauch_media.js, kachelofen_ventilator.js, switch_ventilator.js, notify.js)

### [3.1.26] - 2026-07-14
- feat(vigor166): Enhance DrayTek Vigor 166 alert handling and notification system (connected.js)

### [3.1.25] - 2026-07-14
- feat(pv): Add daily solar forecast vs. actual statistics and enhance data collection (solarprognose_master.js)

### [3.1.24] - 2026-07-14
- feat(vigor166): Add DrayTek Vigor 166 connection status monitoring via Grafana webhooks (connected.js)

### [3.1.23] - 2026-07-14
- feat(fritzbox): Integrate doorbell detection and notification (anruf_klingel_terrasse.js)

### [3.1.22] - 2026-07-13
- chore(pv): Update solar panel azimuth configuration (solarprognose_master.js)

### [3.1.21] - 2026-07-13
- feat(forecast.solar): Add Telegram and Gotify notifications for PV forecast updates (solarprognose_master.js)

### [3.1.20] - 2026-07-12
- feat(pv): Migrate solar forecast script to Forecast.Solar API (solarprognose_master.js)

### [3.1.18] - 2026-07-11
- fix(chargemaster): Improve robustness for charging session recovery and forced stop (charge_master.js)

### [3.1.17] - 2026-07-11
- chore(homematic): Remove verbose logging for online firmware update (homematic_all.js)

### [3.1.16] - 2026-07-10
- refactor(homematic): Refactor online firmware check to use OpenCCU GitHub releases (homematic_all.js)

### [3.1.15] - 2026-07-09
- refactor(homematic): Use optional chaining for firmware version parsing (homematic_all.js)

### [3.1.14] - 2026-07-09
- feat(homematic): Add new data point for CCU firmware update availability (homematic_all.js)

### [3.1.13] - 2026-07-09
- feat(homematic): Add automatic CCU firmware version fetching and enhance monitoring (homematic_all.js)

### [3.1.12] - 2026-07-09
- refactor(homematic): Improve Homematic service type safety and error handling (homematic_all.js)

### [3.1.11] - 2026-07-09
- refactor(homematic): Refactor firmware version comparison logic (homematic_all.js)

### [3.1.10] - 2026-07-08
- chore(linter): Fix linting issues after Biome update (kachelofen_ventilator.js, notify.js)

### [3.1.9] - 2026-07-07
- style(notifications): Standardize global notification messages (usv_wartung_apc_server.js, smartphones_laden.js)

### [3.1.8] - 2026-07-07
- feat(global): Implement AI-powered commit message generation (usv_wartung_apc_server.js, usv_wartung_eaton_buero.js, ai-commit-hook.js)

### [3.1.7] - 2026-07-07
- feat(ups): Add APC UPS maintenance automation script with monitoring and notification support (usv_wartung_apc_server.js)

### [3.1.6] - 2026-07-07
- feat(voice): Add script for terrace Google Home announcement on incoming FRITZ!Box calls (anruf_klingel_terrasse.js)

### [3.1.5] - 2026-07-07
- feat(network): Add UniFi network and UDM Pro firmware version checker script (network_version.js)

### [3.1.4] - 2026-07-07
- feat(network): Add UniFi access point monitoring and network version status scripts (ap_management.js, network_version.js)

### [3.1.3] - 2026-07-07
- refactor(utils): Remove redundant utility functions from codebase (ap_management.js, dyndns_fail.js, neue_ip_failover.js)

### [3.1.2] - 2026-07-06
- feat(evening-light): Add living room evening light automation script with automatic alias repair and GHOME sync suppression (switch_abendlicht.js)

### [3.1.1] - 2026-07-03
- feat(ventilator): Add script to control living room fan based on stove temperature and season (kachelofen_ventilator.js)

### [3.0.6] - 2026-07-02
- feat(pv): Add solarprognose master script and link German documentation in README (solarprognose_master.js)

### [3.0.5] - 2026-07-02
- feat(smarthome): Implement solar prognosis, secret management, Unifi monitoring, and Telegram menu modules (charge_master.js, climate_control.js, location_and_status.js, solarprognose_master.js, setup_secrets.js, network_version.js, telegram_menue.js)

### [3.0.4] - 2026-07-01
- feat(sauna): Add Harvia Fenix sauna controller and automated bedroom lighting script (Fenix_FX110C_Sauna_control.js, schranklicht.js)

### [3.0.3] - 2026-06-30
- feat(notifications): Add global notification utility for Telegram, Gotify, and Chromecast announcements (notify.js)

### [3.0.2] - 2026-06-29
- feat(sauna): Add Harvia Fenix FX 110C sauna control script with cloud integration (Fenix_FX110C_Sauna_control.js)

### [3.0.1] - 2026-06-29
- feat(global): Add multiple automation scripts and configurations for ioBroker management (licht_bewegung_dunkel.js, switch_neu_starten.js, Weihnachtsbaum_Terrasse.js, post_da.js, zustand_r2maeh2.js, Wasserdruckwarnung.js, morgenprogramm.js, trockner.js, waschmaschine.js, Fenix_FX110C_Sauna_control.js, session_master.js, heizung_anwesenheit_master.js, charge_master.js, climate_control.js, location_and_status.js, energiemaster_und_sauna.js, solarprognose_master.js, homematic_all.js, kalender.js, weihnachtszeit.js, battery_states.js, chromecast_ban_heos.js, sayit_autofix.js, sonoff_devices_table.js, syslog_monitor.js, tasmota_fw.js, vaillant_Neustart.js, versionen.js, vis_PIN.js, ziegenhain.js, network_version.js, neue_ip_failover.js, hue_zigbee_states_restore.js, telegram_menue.js, termine_2T.js, baum_Zeitschalt.js, switch_alle_lampen.js, videolicht.js, fully_bewegung.js, ladestation_neustart_hub.js, smartphones_laden.js, switch_ventilator.js, notify.js)

### [2.2.4] - 2026-06-29
- feat(linter): Implement Biome linter and format all automation scripts

### [2.2.3] - 2026-06-29
- feat(monitoring): Add monitoring scripts for NUT client connectivity and Sonoff MQTT availability with alert notifications (sonoff_fail.js, nut_client_inactive.js)

### [2.2.2] - 2026-06-29
- feat(smarthome): Add set of smarthome automation, monitoring, and utility scripts for ioBroker (Weihnachtsbaum_Terrasse.js, geschirr.js, trockner.js, waschmaschine.js, heos_offline.js, batterie_voll.js, batteriehitzewarnung.js, soh_change.js, stromausfall.js, fritz_reboot.js, astrozeiten.js, adapter_off.js, battery_states.js, raumwerte_lueften.js, sonoff_fail.js, tasmota_fw.js, nut_client_inactive.js, telegram_menue.js, sat_tv_auto_aus.js, abendlicht_TV_Wind_aus.js, autolicht_daemmer.js, kachelofen_ventilator.js)

### [2.2.1] - 2026-06-29
- feat(smarthome): Add comprehensive library of ioBroker automation scripts across home and system domains (heizen_rh.js, licht_bewegung_dunkel.js, radio.js, BWM_test.js, Feuchte_Funktion.js, Fruehansage_kueche.js, Garderobenlicht_Schalter.js, IFTTT.js, Licht_schalten.js, Ort_nach_Koordinaten.js, Radio_Status_abfragen.js, Standort_Kfz_telegram.js, TV_Sender_Wozi.js, VU_Sender_GH.js, Waschmaschine_Kosten.js, Zufallslicht_Funktionen.js, function_einbinden.js, geo_api.js, gotify_exec.js, ip_ddnss_ipv4.js, prox_telegram.js, tablet_smar_laden.js, unify_voucher.js, zaehlerstand.js, deckenlampe_auto_aus.js, Weihnachtsbaum_Terrasse.js, muellmeldung.js, post_da.js, zustand_r2maeh2.js, tageskosten.js, fenster_offen.js, garderobenlicht.js, geschirr.js, morgenprogramm.js, trockner.js, licht.js, boiler.js, licht_presence.js, Fenix_FX110C_Sauna_control.js, heos_offline.js, session_master.js, playerstate.js, schranklicht.js, vu_reboot_standby.js, werte_schreiben_silvester.js, serverschrank_taegl.js, weinklima_taegl.js, heizung_anwesenheit_master.js, charge_master.js, climate_control.js, location_and_status.js, batterie_voll.js, batteriehitzewarnung.js, energiemaster_und_sauna.js, march_minsoc.js, soh_change.js, stromausfall.js, fritz_reboot.js, homematic_all.js, astrozeiten.js, weihnachtszeit.js, zeiten.js, adapter_off.js, chromecast_ban_heos.js, raumwerte_lueften.js, sonoff_devices_table.js, sonoff_fail.js, tasmota_fw.js, vis_PIN.js, percent_blocking_both.js, proxmox_master_v2.js, ram_monitor.js, dyndns_fail.js, failover_dyndns_master.js, neue_ip_failover.js, hue_zigbee_states_restore.js, nut_client_inactive.js, usv_wartung_apc_server.js, usv_wartung_eaton_buero.js, telegram_menue.js, termine_2T.js, sat_tv_auto_aus.js, marantz_laeuft.js, radio_heos.js, video_auto_aus.js, abendlicht_TV_Wind_aus.js, autolicht_daemmer.js, baum_Zeitschalt.js, musiklicht.js, ventilator_false.js, videolicht.js, fully_smart_laden.js, ladestation_neustart_hub.js, smartphones_laden.js, verbrauch_media.js, kachelofen_ventilator.js, notify.js)

### [2.1.1] - 2026-06-29
- feat(presence): Add UniFi presence monitoring script with configurable debouncing and notifications (anwesenheit_unifi.js)

### [2.0.87] - 2026-06-29
- refactor(playerstate): Update media player state handler (playerstate.js)
- chore(config): Update TypeScript project config (jsconfig.json)

### [2.0.86] - 2026-06-29
- refactor(dishwasher): Update dishwasher completion script (geschirr.js)

### [2.0.85] - 2026-06-28
- refactor(iobroker): Update restart script and version tracking (iobroker_restart.js, versionen.js)

### [2.0.84] - 2026-06-23
- refactor(sauna): Update Harvia Fenix diagnostic script (Fenix_diagnose_v2.js)

### [2.0.83] - 2026-06-23
- refactor(sauna): Update Harvia Fenix sauna control logic (Fenix_FX110C_Sauna_control.js)

### [2.0.82] - 2026-06-22
- refactor(sauna): Update Harvia Fenix diagnostic script (Fenix_diagnose_v2.js)

### [2.0.81] - 2026-06-22
- refactor(sauna): Update Harvia Fenix sauna control logic (Fenix_FX110C_Sauna_control.js)

### [2.0.80] - 2026-06-22
- refactor(sauna): Update Harvia Fenix sauna control logic (Fenix_FX110C_Sauna_control.js)

### [2.0.79] - 2026-06-22
- refactor(sauna): Update Harvia Fenix sauna control logic (Fenix_FX110C_Sauna_control.js)

### [2.0.78] - 2026-06-22
- chore(deps): Update pre-commit hook and package-lock.json

### [2.0.77] - 2026-06-22
- chore(config): Update jsconfig.json configuration

### [2.0.76] - 2026-06-21
- feat(sauna): Add Fenix FX110C sauna control script with Harvia cloud integration (Fenix_FX110C_Sauna_control.js, Fenix_diagnose.js)

### [2.0.75] - 2026-06-21
- feat(sauna): Add diagnostic script for Harvia Fenix API monitoring and state change tracking (Fenix_diagnose.js)

### [2.0.74] - 2026-06-21
- feat(kia): Introduce EV3 Charge-Master v6.6.0 with robust OCPP stop mechanism, auto-versioning, and enhanced charge management (charge_master.js, auto_version.js)

### [2.0.72] - 2026-06-21
- feat(changelog): Add auto-versioning script and implement automatic changelog rotation from README.md to CHANGELOG_OLD.md (auto_version.js, update_readme_changelog.js)

### [2.0.70] - 2026-06-21
- feat(kia): Implement robust EV3 charging control with OCPP reset sequences, forced stop logic, and improved state management (charge_master.js)

### [2.0.68] - 2026-06-20
- feat(alarm): Implement sensor alarm monitoring script with rate limiting and global notifications (alarmmelder.js)

### [2.0.67] - 2026-06-20
- chore(config): Update ioBroker configuration (.iobroker-config.json)

### [2.0.66] - 2026-06-20
- chore(config): Update ioBroker configuration (.iobroker-config.json)

### [2.0.64] - 2026-06-20
- refactor(mower): Correct device name spelling in notifications (zustand_r2maeh2.js)

### [2.0.62] - 2026-06-20
- refactor(mower): Update device name in notifications (zustand_r2maeh2.js)

### [2.0.60] - 2026-06-16
- fix(mower): Extend max mowing time and refine notifications (zustand_r2maeh2.js)

### [2.0.58] - 2026-06-16
- feat(fully-browser): Enable dim screen activation on motion in night mode (fully_bewegung.js)

### [2.0.56] - 2026-06-16
- fix(sauna): Enforce door safety for remote start (Fenix_FX110C_Sauna_control.js)

### [2.0.54] - 2026-06-15
- fix(sauna): Prioritize actual remote ready states (Fenix_FX110C_Sauna_control.js)

### [2.0.52] - 2026-06-15
- feat(sauna): Add target temperature reached notification (Fenix_FX110C_Sauna_control.js)

### [2.0.50] - 2026-06-15
- feat(sauna): Add 10-minute pre-heating notification (Fenix_FX110C_Sauna_control.js)

### [2.0.48] - 2026-06-09
- fix(mower): Always reset mower return status cleanly (zustand_r2maeh2.js)

### [2.0.46] - 2026-06-08
- fix(mower): Correctly filter power states for hardware changes (zustand_r2maeh2.js)

### [2.0.44] - 2026-06-07
- refactor(sauna): Extend API parsing and refine boolean state normalization (Fenix_FX110C_Sauna_control.js)

### [2.0.42] - 2026-06-07
- refactor(sauna): Improve API data parsing and state normalization (Fenix_FX110C_Sauna_control.js)

### [2.0.40] - 2026-06-02
- refactor(notify): Remove custom titles from global notifications (heizen_rh.js, post_da.js, ziegenhain.js, fully_smart_laden.js, smartphones_laden.js)

### [2.0.38] - 2026-06-02
- chore(sauna): Update preferred radio sender (session_master.js)

### [2.0.36] - 2026-06-01
- refactor(radio): Unify bathroom radio control and adjust volume dynamically by sauna state (radio.js, session_master.js)

### [2.0.27] - 2026-05-29
- feat(sauna): Unify radio and light control for sauna and bath (Fenix_FX110C_Sauna_control.js, radio_master.js, session_master.js)

### [2.0.25] - 2026-05-29
- fix(notify): Sanitize text for voice announcements (zustand_r2maeh2.js, energiemaster_und_sauna.js, notify.js)

### [2.0.23] - 2026-05-28
- refactor(notify): Change alert priority levels (batterie_wechseln.js, usv_wartung_apc_server.js, notify.js)

### [2.0.21] - 2026-05-28
- refactor(notify): Refactor notification handling (notify.js)

### [2.0.13] - 2026-05-28
- refactor(notifications): Translate script notifications to English and remove obsolete notification function (heos_offline.js, auto_version.js)

### [2.0.10] - 2026-05-28
- feat(radio): Add new station 'Jazz Loft' and remove obsolete sauna scripts (radio.js, radio_auto.js, radio_manuell.js, radio_master.js)

### [2.0.7] - 2026-05-28
- feat(radio): Set default volume for radio senders and remove google_utils.js (radio.js, google_utils.js)

### [2.0.1] - 2026-05-27
- refactor(notify): Refactor notification system to use centralized global notify function (heizen_rh.js, radio.js, muellmeldung.js, post_da.js, zustand_r2maeh2.js, Wasserdruckwarnung.js, alarmmelder.js, playerstate.js, vu_reboot_standby.js, energiemaster_und_sauna.js, script_verwaltung.js, ziegenhain.js, ap_management.js, dyndns_fail.js, failover_dyndns_master.js, neue_ip_failover.js, usv_wartung_eaton_buero.js, device_not_available.js, radio_heos.js, video_auto_aus.js, fully_smart_laden.js, smartphones_laden.js, google_utils.js, notify.js)

### [1.22.7] - 2026-05-27
- feat(chromecast): Add whitelist for device IDs in Chromecast adapter (muellmeldung.js, post_da.js, zustand_r2maeh2.js, chromecast_ban_heos.js)

### [1.22.1] - 2026-05-26
- fix(chromecast): Filter non-responding HEOS devices following UDM Pro firmware update (chromecast_ban_heos.js)

### [1.21.51] - 2026-05-26
- fix(chromecast): Add additional banned HEOS device names and IDs, improve name checks, and reduce deletion wait time (chromecast_ban_heos.js)

### [1.21.47] - 2026-05-25
- refactor(battery): Update notification text for full battery storage (batterie_voll.js)

### [1.21.44] - 2026-05-25
- refactor(kia): Translate charge_master.js notifications to English (charge_master.js)

### [1.21.42] - 2026-05-25
- fix(lighting): Repair alias targets in evening light scripts and adjust data types for Google Home (abendlicht_TV_Wind_aus.js, switch_abendlicht.js)

### [1.21.40] - 2026-05-25
- feat(kia): Add constant for WiFi reconnect delay (charge_master.js)

### [1.21.25] - 2026-05-24
- feat(kia): Add robust charging stop mechanism and improve error handling for hanging wallbox status (charge_master.js)

### [1.21.11] - 2026-05-23
- refactor(changelog): Optimize automatic versioning logic (update_readme_changelog.js)

### [1.21.10] - 2026-05-23
- refactor(mower): Implement script optimizations for robotic mower (zustand_r2maeh2.js)

### [1.21.6] - 2026-05-23
- refactor(chromecast): Harden device naming filter (chromecast_ban_heos.js)

### [1.21.1] - 2026-05-22
- feat(sauna): Add data point for active sauna heating (Fenix_FX110C_Sauna_control.js, energiemaster_und_sauna.js)

### [1.20.19] - 2026-05-20
- refactor(sauna): Improve logging output (Fenix_FX110C_Sauna_control.js)

### [1.20.16] - 2026-05-18
- refactor(sauna): Modify oven power reference (Fenix_FX110C_Sauna_control.js)

### [1.20.14] - 2026-05-18
- fix(sauna): Convert string data type to boolean (Fenix_FX110C_Sauna_control.js)

### [1.20.11] - 2026-05-18
- refactor(gotify): Switch Gotify notifications to native httpPost function (post_da.js, charge_master.js, script_verwaltung.js, homematic_all.js, ap_management.js, dyndns_fail.js, neue_ip_failover.js, smartphones_laden.js)

### [1.20.9] - 2026-05-18
- refactor(kia): Extend charging timeout (charge_master.js)

### [1.20.3] - 2026-05-17
- feat(sauna): Enable remote control for Harvia Fenix sauna (Fenix_FX110C_Sauna_control.js)

### [1.19.30] - 2026-05-16
- refactor(kia): Reduce log verbosity (charge_master.js)

### [1.19.19] - 2026-05-14
- feat(sauna): Add fallback URL for Harvia API (Fenix_FX110C_Sauna_control.js)

### [1.19.17] - 2026-05-14
- refactor(chromecast): Adjust HEOS device names (chromecast_ban_heos.js)

### [1.19.15] - 2026-05-13
- fix(kia): Suppress log flood when vehicle is unplugged (charge_master.js)

### [1.19.13] - 2026-05-12
- fix(heating): Resolve race condition between window contact and thermostat (heizen_rh.js)

### [1.19.11] - 2026-05-10
- refactor(chromecast): Adjust HEOS device filter names (chromecast_ban_heos.js)

### [1.17.9] - 2026-05-04
- refactor(sauna): Return to monitoring mode after testing (Fenix_FX110C_Sauna_control.js)

### [1.17.6] - 2026-05-03
- feat(mower): Add error warnings when mower is stuck and remove obsolete script (zustand_r2maeh2.js)

### [1.17.4] - 2026-05-03
- feat(mower): Add average energy cost calculation (zustand_r2maeh2.js)

### [1.17.1] - 2026-05-02
- feat(kia): Implement intelligent power smoothing (charge_master.js)

### [1.16.1] - 2026-05-02
- refactor(kia): Adjust charging data points (charge_master.js)

### [1.13.7] - 2026-05-02
- refactor(network): Extend Amazon IP query timeout to 10s (failover_dyndns_master.js)

### [1.13.3] - 2026-05-01
- fix(chromecast): Delete incorrectly registered device entries (chromecast_ban_heos.js)

### [1.13.1] - 2026-05-01
- fix(kia): Implement intelligent wallbox reset prior to charging session (charge_master.js)

### [1.12.3] - 2026-04-29
- feat(chromecast): Extend device filter to all network devices (chromecast_ban_heos.js)

### [1.12.1] - 2026-04-28
- fix(kia): Prevent charging start if target SoC is already reached (charge_master.js)

### [1.11.1] - 2026-04-24
- feat(sauna): Implement Harvia Fenix sauna controller

### [1.10.11] - 2026-04-23
- refactor(sayit): Update SayIt autofix monitoring (sayit_autofix.js)

### [1.10.3] - 2026-04-23
- refactor(sayit): Enforce stricter symlink monitoring (sayit_autofix.js)

### [1.10.1] - 2026-04-22
- refactor(kia): Improve charging range calculation and reliability (charge_master.js)

### [1.9.10] - 2026-04-18
- fix(zigbee): Delay Zigbee device failure notification by 15 minutes (device_not_available.js)

### [1.9.8] - 2026-04-18
- feat(ventilation): Reactivate SayIt voice output in room ventilation script (raumwerte_lueften.js)

### [1.9.4] - 2026-04-16
- feat(location): Switch map provider to Google Maps (location_and_status.js)

### [1.9.2] - 2026-04-14
- refactor(sayit): Update SayIt cache fix (sayit_autofix.js)

### [1.9.1] - 2026-04-14
- chore(fuel): Remove obsolete gas station scripts and menu items (Auswertung_guenstigste_Tankstelle.js, guenstige_Tankstelle.js, telegram_menue.js)

### [1.8.1] - 2026-04-11
- refactor(kia): Add 45s debounce on charging state change (charge_master.js)

### [1.7.7] - 2026-04-09
- refactor(charging): Adjust smartphone battery threshold to 35-80% (smartphones_laden.js)

### [1.7.5] - 2026-04-07
- fix(mower): Restore voice announcements for robotic mower (zustand_r2maeh2.js)

### [1.7.3] - 2026-04-05
- refactor(heating): Update heating presence master script (heizung_anwesenheit_master.js)

### [1.7.2] - 2026-04-04
- refactor(charging): Remove presence check criterion from smartphone charging (smartphones_laden.js)

### [1.7.1] - 2026-04-04
- refactor(heating): Change default heating profile from 3 to 1 (heizung_anwesenheit_master.js)

### [1.6.4] - 2026-03-31
- feat(presence): Add Thomas_6G to UniFi presence monitoring (anwesenheit_unifi.js)

### [1.6.3] - 2026-03-24
- fix(voice): Suppress emoji pronunciation in full battery announcement (batterie_voll.js)

### [1.6.1] - 2026-03-23
- fix(kia): Handle excess charging state when wallbox status is 'Finishing' (charge_master.js)

### [1.5.6] - 2026-03-21
- refactor(appliances): Update dryer and washing machine monitoring (trockner.js, waschmaschine.js)

### [1.5.4] - 2026-03-16
- refactor(chromecast): Update Chromecast ban list (chromecast_ban_heos.js)

### [1.5.3] - 2026-03-16
- refactor(battery): Reset full battery notification threshold to 100% (batterie_voll.js)

### [1.5.2] - 2026-03-16
- refactor(energy): Adjust data points for energy master and sauna (energiemaster_und_sauna.js)

### [1.5.1] - 2026-03-16
- refactor(energy): Increase sauna power threshold to 7500W (energiemaster_und_sauna.js)

### [1.4.1] - 2026-03-16
- chore(appliances): Remove obsolete aliases (trockner.js, waschmaschine.js)
- refactor(climate): Adjust temperature threshold (climate_control.js)
- refactor(battery): Update seasonal battery threshold to 30% (batterie_voll.js, march_minsoc.js)

### [1.3.7] - 2026-03-14
- refactor(appliances): Update washing machine script (waschmaschine.js)

### [1.3.6] - 2026-03-14
- fix(security): Store PIN in 0_userdata.0 data structure instead of plain script text (vis_PIN.js)

### [1.3.4] - 2026-03-13
- refactor(battery): Reset battery threshold to 100%, optimize logic and comments (batterie_voll.js)

### [1.3.3] - 2026-03-13
- feat(kia): Preserve original house battery MinSoC during EV charging (charge_master.js)

### [1.3.1] - 2026-03-12
- feat(kia): Protect house battery during manual EV charging (charge_master.js)

### [1.2.5] - 2026-03-11
- refactor(heating): Update stove ventilator script (kachelofen_ventilator.js)

### [1.2.4] - 2026-03-10
- style(global): Format scripts using Prettier code formatter

### [1.2.3] - 2026-03-09
- feat(kia): Add minute announcement for remaining charge time (charge_master.js)

### [1.0.12] - 2026-03-08
- refactor(global): Update automation scripts and version management (fenster_offen.js, trockner.js, waschmaschine.js, vu_reboot_standby.js, auto_version.js)

### [1.0.1] - 2026-03-08
- feat(global): Initialize script collection and automatic versioning
