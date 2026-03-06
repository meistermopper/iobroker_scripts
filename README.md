## 🚀 Workflow & Synchronisation
Die Verwaltung der Skripte erfolgt getrennt nach Entwicklung (VS Code) und Laufzeit (ioBroker).

* **Source of Truth**: Die primäre Entwicklungsumgebung ist **VS Code**.
* **Deployment**: Die Übertragung zum ioBroker erfolgt **manuell** über die ioBroker-Extension (Bereich "CHANGED SCRIPTS"). Ein Klick auf den **Upload-Pfeil** aktiviert das Skript sofort im ioBroker.
* **Backup & Cloud**: Die langfristige Sicherung erfolgt über Git. Ein Push zu GitHub wird manuell über VS Code durchgeführt, wenn ein Skript stabil läuft.

### Tägliche Arbeit
1. **Editieren**: Änderungen in VS Code vornehmen und speichern.
2. **Aktivieren**: Über den **Pfeil nach oben** in der ioBroker-Seitenleiste zum Server schieben.
3. **Sichern**: 
   * `Commit`: Stand lokal versionieren.
   * `Push`: Stand zu GitHub hochladen.