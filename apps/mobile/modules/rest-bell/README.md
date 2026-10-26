# rest-bell (lokales Expo-Modul)

Glocke am Pausenende über Kopfhörer, auch bei gesperrtem iPhone, plus Kopfhörer-Erkennung.
Swift in `ios/RestBellModule.swift`, JS-Typen in `index.ts`. Wird aus `apps/mobile/modules/` automatisch
gelinkt (`expo prebuild`), braucht kein `package.json`.

Nur am Mac bauen und testen (Dev-Build/TestFlight); in Jest und älteren Dev-Clients ist `RestBell` `null`
und die App fällt auf die Notification zurück. Entscheidung, Fallback-Logik und Testplan: `docs/REST_BELL.md`.
