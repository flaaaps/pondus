# Pondus – App-Verteilung ohne MacBook

Stand: 26.10.2026. Status: 🟡 Einrichtung erledigt (Phase 1, ohne MacBook), erster CI-Lauf offen. Workflow: `.github/workflows/ios-testflight.yml`.

Ziel: Neue App-Versionen kommen auf Julians iPhone, ohne dass das MacBook laufen muss. Ein Build startet automatisch (Tag oder Knopf in GitHub), installiert wird über einen Link bzw. die TestFlight-App. Reine JS-Änderungen sollen später auch ohne neuen nativen Build ankommen.

**Empfehlung in einem Satz:** GitHub Actions (macOS-Runner, für unser öffentliches Repo kostenlos) baut und signiert die App und lädt sie zu **TestFlight (interne Tester)** hoch. EAS Update kommt als optionale zweite Stufe für JS-Hotfixes dazu. Ad-hoc-OTA und EAS Build bleiben dokumentierte Fallbacks.

## 1. Ausgangslage

| Punkt | Stand |
| --- | --- |
| App | `apps/mobile`, Expo SDK 58, RN 0.88, iOS-only, Continuous Native Generation: `ios/` ist nicht eingecheckt und wird mit `expo prebuild` erzeugt |
| Native Teile | `expo-dev-client` (nur Debug), `expo-widgets` mit Widget-Extension `ExpoWidgetsTarget` (`app.pondus.ios.ExpoWidgetsTarget`), App Group `group.app.pondus.ios`, `expo-notifications`, `expo-sqlite`, `expo-secure-store` |
| Bundle-ID | `app.pondus.ios`, Version `0.1.0` in `app.json`, keine `buildNumber` gesetzt |
| Apple-Team | `XTA9CPY447`, Organisation „studypilot UG (haftungsbeschränkt)“, geteilt mit studypilot. App-IDs `app.pondus.ios` (App Groups, Push) und `app.pondus.ios.ExpoWidgetsTarget` (App Groups) |
| App Store Connect | App-Eintrag „Pondus - Krafttraining“, Apple-ID `6827056782`, SKU `pondus-ios` |
| Builds bisher | lokal auf dem MacBook mit Xcode 26.6: `pnpm prebuild && pnpm ios`, Release-Build per Kabel aufs iPhone 15 Pro (iOS 27.2) |
| API-URL | wird beim Bundling aus `EXPO_PUBLIC_API_URL` eingebacken (`src/lib/env.ts`). Backend nur im Tailnet: `https://jupi.tail0ee0a3.ts.net:4010` |
| Repo | `github.com/flaaaps/pondus`, **öffentlich**. Bestehende Actions: `web.yml` (Homepage auf GitHub Pages) |
| Raspberry Pi | kann keine iOS-Builds. Dort laufen nur Typecheck, Lint und Jest |

Folge aus dem Tailnet-Backend: Jede installierte App funktioniert nur auf Geräten mit aktivem Tailscale. Für Julians iPhone ist das gegeben, für jeden weiteren Tester auch nötig.

## 2. Verteilungswege

### 2.1 Übersicht

| Weg | Kosten | Gerät registrieren | Review | Ablauf | Installation | Eignung |
| --- | --- | --- | --- | --- | --- | --- |
| **TestFlight intern** | im Developer-Programm enthalten | nein | nein | 90 Tage pro Build | TestFlight-App, Push bei neuem Build | ✅ Hauptweg |
| TestFlight extern | enthalten | nein | erster Build je Version durch Beta-Review | 90 Tage | öffentlicher Link oder Einladung | erst bei Testern außerhalb des Teams |
| Ad-hoc-OTA (`itms-services://`) | enthalten | ja, UDID, max. 100 iPhones pro Mitgliedsjahr | nein | bis Profil oder Zertifikat abläuft (≤ 1 Jahr) | Link in Safari | Fallback |
| EAS Build + Submit | Free: 15 iOS-Builds/Monat, danach Starter $19/Monat | nein (TestFlight) | wie TestFlight | wie TestFlight | TestFlight | Alternative zur eigenen Pipeline |
| EAS Update / expo-updates | Free: 1.000 MAU | – | nein | – | beim nächsten App-Start | ✅ Ergänzung für JS-Hotfixes |
| Enterprise-Programm | 299 USD/Jahr | nein | nein | 1 Jahr | Link | ❌ nicht zulässig (siehe 2.6) |

### 2.2 TestFlight

- **Interne Tester:** bis zu 100 App-Store-Connect-Nutzer des Teams. Julian ist als Account Holder automatisch einer. Interne Builds brauchen **keine** Beta-Review und stehen bereit, sobald Apple sie verarbeitet hat (laut Expo üblicherweise 10–15 Minuten, gelegentlich länger).
- **Externe Tester:** bis zu 10.000, Einladung per E-Mail oder öffentlichem Link. Der erste Build einer Version geht in die Beta-Review, Folgebuilds meist nicht vollständig. Für Freunde ohne Team-Zugang wäre das der Weg, aber nur sinnvoll, wenn sie ins Tailnet kommen.
- **Ablauf:** Ein Build ist 90 Tage nach dem Upload nicht mehr startbar. Wer länger nichts baut, startet den Workflow einmal ohne Änderungen neu.
- **Upload aus CI:** mit einem App Store Connect API Key (`.p8`, Key ID, Issuer ID). Kein Apple-ID-Passwort, keine 2FA im CI. Alternativen zum Hochladen: `xcrun altool --upload-app` (im Entwurf), Transporter, `fastlane pilot`, `eas submit`.
- **Voraussetzungen:** App-Eintrag in App Store Connect für `app.pondus.ios`. Der Store-Name muss im App Store eindeutig sein (Risiko, siehe 7). `ITSAppUsesNonExemptEncryption = false` steht schon in `app.json`, damit entfällt die Exportfrage bei jedem Build.
- **Upload-Anforderung:** Seit dem 28.04.2026 müssen Uploads mit Xcode 26 und iOS-26-SDK gebaut sein, ab April 2027 mit dem iOS-27-SDK. Xcode 26.6 (MacBook und Runner) reicht bis dahin.

### 2.3 Ad-hoc-OTA

Ablauf: Ad-hoc-Profile für App **und** Extension (beide mit App Group) enthalten die UDIDs der erlaubten Geräte. Die `.ipa` liegt mit einer `manifest.plist` auf einem HTTPS-Server mit gültigem Zertifikat. Ein Link `itms-services://?action=download-manifest&url=https://…/manifest.plist` in Safari installiert die App.

| Punkt | Bewertung |
| --- | --- |
| Geräte | jede UDID einzeln im Developer Portal registrieren, bis 100 pro Gerätefamilie und Mitgliedsjahr. Deaktivieren gibt keinen Platz frei, erst zu Beginn des neuen Mitgliedsjahrs |
| Neues Gerät | Profile neu erzeugen, Secrets tauschen, neu bauen |
| Hosting auf GitHub Pages | technisch möglich (HTTPS vorhanden), aber öffentlich: Jeder kann die `.ipa` laden. Installieren kann sie nur ein registriertes Gerät, die eingebackene Tailnet-URL ist trotzdem sichtbar. Außerdem müsste `web.yml` die Datei mit veröffentlichen. Nicht empfohlen |
| Hosting im Tailnet | `tailscale serve` auf dem Pi liefert ein gültiges `*.ts.net`-Zertifikat, nur Tailnet-Geräte sehen die Datei. Braucht einen eigenen Port oder Pfad und einmalig Root-Rechte (Operator), die laufende API bleibt unberührt. Der Upload vom Runner auf den Pi bräuchte einen Tailscale-Zugang für GitHub Actions (OAuth-Client, ephemerer Knoten) |
| Developer Mode | für Ad-hoc-Builds nach unserem Kenntnisstand nicht nötig (nur für Development-signierte Apps), nicht geprüft |
| Bekanntes Problem | Apple-Forum, iOS 26.5–26.7: Ein OTA-Update, das **aus der laufenden App** angestoßen wird, hängt, bis die App beendet wird. Installation aus Safari ist nicht betroffen |

Fazit: mehr Pflege als TestFlight (UDIDs, eigenes Hosting, Tailscale im CI) und kein Vorteil für Julian allein. Nur sinnvoll, wenn TestFlight ausfällt oder ein Build ohne App-Store-Connect-Verarbeitung nötig ist. Der Workflow-Entwurf kann dafür mit `method = release-testing` und Ad-hoc-Profilen exportieren.

### 2.4 EAS Build, EAS Submit, interne Verteilung

| Plan | Preis | iOS-Builds | Warteschlange | macOS gleichzeitig | Timeout |
| --- | --- | --- | --- | --- | --- |
| Free | $0 | bis 15 pro Monat, danach Stopp (keine Überziehung) | niedrige Priorität, zu Spitzenzeiten 90+ min | 1 | 45 min |
| Starter | $19/Monat + Nutzung | $45 Guthaben, iOS $2 (medium) / $4 (large) pro Build | hoch | 2 | – |
| Production | $199/Monat + Nutzung | $225 Guthaben | hoch | 10 | – |

- **Credentials:** EAS legt Distribution-Zertifikat und Profile selbst an und erkennt die Extension, weil das `expo-widgets`-Plugin sie unter `extra.eas.build.experimental.ios.appExtensions` anmeldet. App Groups synchronisiert EAS nur mit Apple-ID-Login (Cookie), nicht mit API Key, also beim ersten Build interaktiv auf dem Mac. Bei uns sind App Group und App-IDs schon eingerichtet.
- **EAS Submit** lädt nach TestFlight hoch, auch nicht-interaktiv aus CI mit `EXPO_TOKEN` und `ascAppId`.
- **Interne Verteilung** (`distribution: internal`) ist Ad-hoc mit von EAS gehosteter Installationsseite. Gleiche UDID-Pflicht wie 2.3, aber kein eigenes Hosting.
- **Lokal statt Cloud:** `eas build --local` führt die EAS-Schritte auf einem eigenen Mac oder Runner aus, braucht aber trotzdem Expo-Login und kennt keinen Cache.
- **Xcode:** Das EAS-Image `sdk-58` nutzt Xcode 27.1, also eine andere Version als lokal (26.6).
- **Bewertung:** weniger Pflege beim Signing, dafür Expo-Konto als Abhängigkeit, Warteschlange im Free-Plan und ein Monatskontingent. Bei Julians Takt (wenige Builds pro Woche) würde Free reichen. Plan B, falls das manuelle Signing in GitHub Actions zu viel Pflege macht.

### 2.5 EAS Update / expo-updates

`expo-updates` lädt beim App-Start ein neues JS-Bundle samt Assets und nutzt es (Standard `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`: Download beim Start, aktiv ab dem nächsten Start).

| Änderung | JS-Update reicht? |
| --- | --- |
| Screens, Logik, Styles in `src/`, `packages/shared`, Bilder und Fonts im Bundle | ✅ |
| Layout der Live Activity (die `'widget'`-Funktion wird zur Laufzeit per `createLiveActivity()` in die App Group geschrieben) | vermutlich ✅, solange nur vorhandene `@expo/ui`-Komponenten genutzt werden. **Ungetestet** |
| Neue oder aktualisierte native Module (z. B. `expo-widgets` selbst, neue Expo-Pakete) | ❌ neuer Build |
| `app.json`: Plugins, `infoPlist`, Entitlements, Icon, Splash, Bundle-ID | ❌ neuer Build |
| Expo-SDK- oder React-Native-Update | ❌ neuer Build |
| `EXPO_PUBLIC_API_URL` ändern | ✅, wird beim Export des Updates eingebacken |

- **Kompatibilität:** Ein Update läuft nur auf Builds mit gleicher `runtimeVersion`. Wir nehmen `runtimeVersion: { policy: "fingerprint" }`: Expo berechnet sie aus allem, was die native Seite beeinflusst. Inkompatible Updates sind damit praktisch ausgeschlossen. Mit `appVersion` müsste man bei jeder nativen Änderung selbst die Version erhöhen.
- **Dev-Client vs. Release:** Im Debug-Build mit `expo-dev-client` lädt die App immer von Metro, die meisten Updates-APIs sind dort nicht verfügbar. Veröffentlichte Updates lassen sich im Dev-Client aber über den Extensions-Tab ansehen. Erst der Release-Build (TestFlight) holt Updates automatisch. Beide vertragen sich, `expo-updates` muss aber einmal per nativem Build in die App.
- **Dienst:** EAS Update Free (1.000 aktive Nutzer pro Monat, reicht weit) braucht ein Expo-Konto und `eas init` (Projekt-ID in `app.json`). Selbst hosten auf dem Pi ginge über das offene Expo-Updates-Protokoll (Referenzserver von Expo, `expo-open-ota`), wäre aber ein weiterer Dienst und hier nicht empfohlen.
- **Apple-Regeln:** JS-Updates sind erlaubt, solange sie den Zweck der App nicht ändern.
- **Bewertung:** lohnt sich erst, wenn 20–35 Minuten Build plus TestFlight-Verarbeitung für kleine Korrekturen stören. Deshalb Phase 4, optional.

### 2.6 Enterprise-Programm, Apple Business

Nicht möglich und nicht nötig. Das Enterprise-Programm (299 USD/Jahr) verlangt eine juristische Person mit mindestens 100 Mitarbeitenden, D-U-N-S-Nummer und Verifizierungsgespräch. Es ist nur für interne Apps an Angestellte gedacht und ausdrücklich nicht für Beta-Tests (dafür ist TestFlight da). Custom Apps über Apple Business Manager laufen über den normalen App-Store-Review und richten sich an Firmenkunden.

## 3. Build-Pipeline

### 3.1 GitHub Actions mit macOS-Runner (empfohlen)

| Punkt | Stand Oktober 2026 |
| --- | --- |
| Kosten | Standard-Runner sind für öffentliche Repos kostenlos, auch macOS. Wird das Repo privat: GitHub Free enthält 2.000 Minuten pro Monat, macOS kostet $0,062 pro Minute, ein Build also grob $1,50–2,20 |
| Runner | `macos-26` (= `macos-latest`): arm64 M1, 3 Kerne, 7 GB RAM, 14 GB SSD |
| Xcode | Standard 26.6, außerdem 26.0.1 bis 26.5. Xcode 27 nur als Public Preview. Wir pinnen 26.6 über `DEVELOPER_DIR`, wie auf dem MacBook |
| Vorinstalliert | Node 24, CocoaPods 1.17, fastlane 2.241, xcbeautify 3.2, jq |
| Laufzeit (Schätzung) | Install 2 min, Checks 2 min, Prebuild 1 min, Pod install 3–6 min (mit Cache 1–2), Archive 12–25 min, Export und Upload 2–4 min: **etwa 20–35 min**, erster Lauf eher 40. Timeout 75 min |
| Caching | pnpm-Store über `setup-node`, `ios/Pods` über `actions/cache` (Schlüssel: Lockfile + `package.json`). DerivedData bewusst nicht, weil es den knappen Speicher füllt und bei Archiven wenig bringt |
| Sicherheit | Läuft nur bei `workflow_dispatch` und Tag `ios-v*`, nie bei Pull Requests. Secrets liegen im Environment `testflight`, das nur `main` und `ios-v*`-Tags darf. Keine `.ipa` als Artefakt, weil Artefakte öffentlicher Repos für jeden angemeldeten GitHub-Nutzer ladbar sind |

**Signing:** Für die CI wählen wir manuelles Signing:

- ein Apple-Distribution-Zertifikat (`.p12`),
- zwei App-Store-Profile, eins für `app.pondus.ios` und eins für `app.pondus.ios.ExpoWidgetsTarget`, beide mit App Group.

Nach dem Prebuild stellt `fastlane run update_code_signing_settings` beide Targets auf diese Profile um, ohne Fastfile. Danach laufen `xcodebuild archive`, `-exportArchive` mit `ExportOptions.plist` (beide Bundle-IDs zugeordnet) und `altool --upload-app` mit dem API Key.

| Signing-Variante | Pro | Contra | Entscheidung |
| --- | --- | --- | --- |
| **Manuell: `.p12` + 2 Profile als Secrets** | deterministisch, keine Apple-Kommunikation beim Signieren, Key braucht nur Upload-Rechte | Profile und Zertifikat einmal im Jahr erneuern und Secrets tauschen | ✅ |
| Automatisch mit `-allowProvisioningUpdates` + API Key (Cloud Signing) | nur ein Secret | braucht Admin-Key; laut Apple-Forum unzuverlässig; auf frischen Runnern legt Xcode ggf. jedes Mal neue Development-Zertifikate an | ❌ |
| fastlane match | Standard für Teams, erneuert selbst | eigenes privates Zertifikats-Repo oder Bucket, Ruby-Setup, Fastfile | ❌ für ein Ein-Personen-Projekt zu viel |

**Build-Nummer und Version:**

- `CFBundleVersion` = `github.run_number` + optional `vars.IOS_BUILD_NUMBER_OFFSET`. Steigt immer, ist pro Workflow eindeutig und wird nur im Runner gesetzt, nicht committet. Falls Julian je lokal hochlädt, den Offset so setzen, dass die CI-Nummern darüber liegen.
- Der Workflow schreibt Build-Nummer und Version zusätzlich in die Info.plist der Extension, weil Apple sonst wegen abweichender Versionen warnt (ITMS-90473).
- `CFBundleShortVersionString` = `expo.version` aus `app.json`. Bei einer neuen Version wird sie per PR erhöht (z. B. `0.2.0`), danach kommt ein Tag `ios-v0.2.0` auf `main`. Eine neue Version braucht keine Review, solange sie nur intern verteilt wird.

**Secrets und Variablen:**

| Name | Art | Inhalt | Quelle |
| --- | --- | --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | Secret (Environment `testflight`) | Apple-Distribution-Zertifikat mit Schlüssel | Schlüsselbund auf dem Mac, Export als `.p12` |
| `IOS_DIST_CERT_PASSWORD` | Secret | Passwort der `.p12` | beim Export gewählt |
| `IOS_PROFILE_APP_BASE64` | Secret | App-Store-Profil `app.pondus.ios` | Developer Portal |
| `IOS_PROFILE_WIDGET_BASE64` | Secret | App-Store-Profil `app.pondus.ios.ExpoWidgetsTarget` | Developer Portal |
| `ASC_API_KEY_ID` | Secret | Key ID | App Store Connect → Integrationen |
| `ASC_API_ISSUER_ID` | Secret | Issuer ID | dito |
| `ASC_API_KEY_P8_BASE64` | Secret | `AuthKey_<ID>.p8` | einmaliger Download |
| `APPLE_TEAM_ID` | Variable | `XTA9CPY447` | – |
| `EXPO_PUBLIC_API_URL` | Variable | `https://jupi.tail0ee0a3.ts.net:4010` | – |
| `IOS_BUILD_NUMBER_OFFSET` | Variable, optional | z. B. `0` | – |

Das Keychain-Passwort erzeugt der Workflow pro Lauf zufällig, dafür braucht es kein Secret.

### 3.2 EAS Build als Alternative

Gleicher Auslöser in GitHub Actions, aber nur ein kleiner Ubuntu-Job: `eas build -p ios --profile production --auto-submit --non-interactive` mit `EXPO_TOKEN`. Nötig wären `eas.json` (Profil `production` mit `autoIncrement` für die Build-Nummer, `submit.production.ios.ascAppId`), `eas init` und die API-URL als EAS-Umgebungsvariable. Wechselgrund: wenn das manuelle Signing oder die Runner-Images mehr Pflege machen als das Free-Kontingent kostet.

## 4. Empfehlung

1. **Jetzt:** GitHub Actions → TestFlight intern. Für das öffentliche Repo kostenlos, ohne Warteschlange und mit derselben Xcode-Version und denselben Befehlen wie lokal. Es kommt kein neuer Dienstleister dazu. Installation und Updates laufen über die TestFlight-App, auf Wunsch mit automatischen Updates.
2. **Danach, optional:** `expo-updates` + EAS Update (Free) mit `fingerprint`-Runtime für JS-Hotfixes in Minuten.
3. **Fallbacks:** EAS Build/Submit, falls die eigene Pipeline zu viel Pflege braucht. Ad-hoc-OTA im Tailnet, falls TestFlight nicht verfügbar ist.

## 5. Umsetzungsplan

### Phase 0 – Klärung ⬜ (15 min)
Offene Fragen 1–3 aus Abschnitt 9 beantworten. Keine davon blockiert den Plan, sie bestimmen nur Kleinigkeiten (Rollen, App-Name).

### Phase 1 – Einmalige Einrichtung bei Apple ✅ (26.10.2026, ohne MacBook)

**So wurde es gemacht:** Julian hat vom iPhone aus den App-Eintrag angelegt und zwei Team-API-Keys erzeugt: Admin `6V5242YH2A` nur für die Einrichtung, App Manager `HT4G76T9HV` für die CI. Die `.p8` liegen in Infisical (Projekt „studypilot“, `prod`) als `PONDUS_ADMIN` und `PONDUS_MANAGER`, die IDs als `PONDUS_ADMIN_KEY_ID`, `PONDUS_MANAGER_KEY_ID` und `PONDUS_ASC_ISSUER_ID`. Den Rest hat Claude vom Pi aus über die App Store Connect API erledigt:

- **Zertifikat:** Privater Schlüssel und CSR wurden mit `openssl` erzeugt. Das Team hatte schon die maximal 3 Distribution-Zertifikate. Das von keinem Profil genutzte `B8JAT5TSA7` (Ablauf 18.01.2027) wurde widerrufen und durch das neue Apple-Distribution-Zertifikat `AR6372J824` ersetzt, gültig bis 26.10.2027. Die beiden studypilot-Zertifikate blieben unberührt.
- **Profile:** „Pondus AppStore“ (`app.pondus.ios`, App Group und Push `production`) und „Pondus Widget AppStore“ (`app.pondus.ios.ExpoWidgetsTarget`, App Group), beide gültig bis 26.10.2027.
- **GitHub:** Environment `testflight`, nur für Branch `main` und Tags `ios-v*`, mit den Secrets aus 3.1. Dazu die Repo-Variablen `APPLE_TEAM_ID` und `EXPO_PUBLIC_API_URL`.
- **Backup:** `.p12` als `PONDUS_DIST_P12_BASE64` und Passwort als `PONDUS_DIST_P12_PASSWORD` in Infisical. Das Schlüsselmaterial auf dem Pi wurde danach mit `shred` gelöscht.

**Offen:** Den Admin-Key `6V5242YH2A` in App Store Connect widerrufen, sobald der erste Lauf grün ist; die jährliche Erneuerung braucht ihn neu. Auf dem iPhone TestFlight installieren und eine interne Gruppe mit automatischer Verteilung anlegen (Schritt 7 unten).

**Erneuerung im Oktober 2027:** Wie oben ohne Mac. Neuen Admin-Key anlegen, neues Zertifikat aus neuer CSR erzeugen, beide Profile neu erzeugen, Secrets und Backup tauschen.

Die folgenden Schritte beschreiben den ursprünglichen Weg über den Mac. Sie bleiben als Alternative stehen.

**1. App-Eintrag in App Store Connect** (appstoreconnect.apple.com → Apps → „+“ → Neue App)
- Plattform iOS, Name z. B. „Pondus“ (falls vergeben: „Pondus – Krafttraining“; der Name auf dem Home-Bildschirm bleibt „Pondus“), Sprache Deutsch, Bundle-ID `app.pondus.ios`, SKU `pondus-ios`.
- Unter App-Informationen die **Apple-ID** (Zahl) notieren. Die braucht nur EAS Submit, der Workflow nicht.

**2. Capabilities prüfen** (developer.apple.com → Certificates, IDs & Profiles → Identifiers)
- `app.pondus.ios`: App Groups (`group.app.pondus.ios`) ✅, Push Notifications, falls der lokale Release-Build ein `aps-environment` enthält. Prüfen auf dem Mac mit dem zuletzt lokal gebauten Release:
  ```bash
  codesign -d --entitlements :- ~/Library/Developer/Xcode/DerivedData/Pondus-*/Build/Products/Release-iphoneos/Pondus.app
  ```
- `app.pondus.ios.ExpoWidgetsTarget`: App Groups (`group.app.pondus.ios`) ✅.

**3. Apple-Distribution-Zertifikat** (falls noch keins existiert)
- Xcode → Settings → Accounts → Team `XTA9CPY447` → Manage Certificates → „+“ → Apple Distribution.
- Schlüsselbundverwaltung → Meine Zertifikate → „Apple Distribution: …“ samt privatem Schlüssel exportieren als `pondus-dist.p12` mit starkem Passwort.

**4. Zwei App-Store-Profile** (Profiles → „+“ → Distribution → App Store Connect)
- `Pondus AppStore` für `app.pondus.ios` mit dem Zertifikat aus Schritt 3.
- `Pondus Widget AppStore` für `app.pondus.ios.ExpoWidgetsTarget`.
- Beide als `.mobileprovision` herunterladen. Wurden die Profile erstellt, bevor die App Group zugewiesen war, neu erzeugen.

**5. App Store Connect API Key** (Benutzer und Zugriff → Integrationen → App Store Connect API → Team-Schlüssel)
- Ggf. „Zugriff anfordern“ (wird laut Berichten meist sofort gewährt). Schlüssel „GitHub Actions Pondus“, Rolle **App Manager**.
- `AuthKey_XXXX.p8` herunterladen (nur einmal möglich), Key ID und Issuer ID notieren.

**6. GitHub einrichten** (Terminal auf dem Mac, mit `gh` angemeldet; Werte landen direkt in GitHub, nicht im Repo oder in der Shell-History)
```bash
cd ~/Downloads   # Ort der heruntergeladenen Dateien
R=flaaaps/pondus
gh api -X PUT repos/$R/environments/testflight \
  -F 'deployment_branch_policy[protected_branches]=false' -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/$R/environments/testflight/deployment-branch-policies -f name=main -f type=branch
gh api -X POST repos/$R/environments/testflight/deployment-branch-policies -f name='ios-v*' -f type=tag

base64 -i pondus-dist.p12 | gh secret set IOS_DIST_CERT_P12_BASE64 -R $R --env testflight
gh secret set IOS_DIST_CERT_PASSWORD -R $R --env testflight            # fragt das Passwort ab
base64 -i Pondus_AppStore.mobileprovision        | gh secret set IOS_PROFILE_APP_BASE64    -R $R --env testflight
base64 -i Pondus_Widget_AppStore.mobileprovision | gh secret set IOS_PROFILE_WIDGET_BASE64 -R $R --env testflight
gh secret set ASC_API_KEY_ID    -R $R --env testflight                  # fragt ab
gh secret set ASC_API_ISSUER_ID -R $R --env testflight                  # fragt ab
base64 -i AuthKey_XXXX.p8 | gh secret set ASC_API_KEY_P8_BASE64 -R $R --env testflight

gh variable set APPLE_TEAM_ID       -R $R --body XTA9CPY447
gh variable set EXPO_PUBLIC_API_URL -R $R --body https://jupi.tail0ee0a3.ts.net:4010
```
Danach `.p12`, `.p8` und Profile in einen Passwortmanager oder Infisical legen und aus `~/Downloads` löschen.

**7. iPhone:** TestFlight aus dem App Store installieren, mit derselben Apple-ID wie das Developer-Konto anmelden. In App Store Connect → TestFlight → Interne Tests eine Gruppe „Team“ mit Julian anlegen und „Automatische Verteilung“ einschalten.

### Phase 2 – Workflow aktivieren und erster Lauf ⬜ (0,5–1 Tag inkl. Iterationen)
- Workflow aktiviert (26.10.2026, mit dem PR dieses Plans). Nach dem Merge auf `main`:
- Actions → „iOS TestFlight“ → Run workflow mit `upload = false`: prüft Prebuild, Signing und Export ohne Upload.
- Typische Nacharbeiten beim ersten Lauf: Profilnamen, Entitlements (Push), Pfad der Extension-Info.plist, Speicherplatz.
- Danach mit `upload = true`. Ab dann: Version in `app.json` erhöhen, mergen, `git tag ios-v0.1.0 && git push origin ios-v0.1.0`, oder jederzeit manuell starten.

### Phase 3 – Installation und Abnahme ⬜ (30 min)
Testplan aus Abschnitt 8 auf dem iPhone. Danach in `IMPLEMENTATION_PLAN.md` und `README.md` den Release-Weg eintragen.

### Phase 4 – JS-Updates (optional) ⬜ (0,5–1 Tag)
- `npx expo install expo-updates`, `eas init`, in `app.json` `runtimeVersion: { policy: "fingerprint" }`, `updates.url` und Kanal `production`.
- Danach ist ein nativer Build nötig, der `expo-updates` enthält.
- Zweiter Workflow `ios-update.yml` (Ubuntu, `EXPO_TOKEN`): `eas update --channel production --environment production` mit `EXPO_PUBLIC_API_URL` aus den Variablen.
- Optional: Der Workflow vergleicht den Fingerprint (`npx expo-updates fingerprint:generate`) mit dem letzten Build und startet bei Abweichung statt des Updates den nativen Build.
- Live-Activity-Layout per Update testen (siehe 2.5).

### Phase 5 – Ad-hoc-Fallback (nur bei Bedarf) ⬜ (0,5 Tage)
UDID registrieren, Ad-hoc-Profile für beide Targets, zweite Export-Variante (`method = release-testing`). Hosting per `tailscale serve` auf dem Pi unter eigenem Port. Upload aus dem Runner über einen ephemeren Tailscale-Knoten (`tailscale/github-action`, OAuth-Client als Secret) oder manuell.

## 6. Laufzeit und Kosten

| Posten | Schätzung |
| --- | --- |
| Build in GitHub Actions | 20–35 min, $0 (öffentliches Repo) |
| TestFlight-Verarbeitung | 10–30 min |
| Vom Tag bis zur App auf dem iPhone | etwa 30–60 min |
| Apple Developer Program | 99 USD/Jahr (vorhanden) |
| EAS Update (Phase 4) | $0 im Free-Plan |
| Pflege | jährlich Zertifikat und Profile erneuern (15 min); nach Expo-SDK-Updates und Xcode-Wechseln einen Testlauf machen |

## 7. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Widget-Extension falsch signiert (Profil ohne App Group, falsche Zuordnung in `ExportOptions.plist`) | Export- oder Upload-Fehler, oder die Live Activity startet nicht | Workflow prüft Entitlements im generierten Projekt und in der fertigen `.ipa`; Profile erst nach dem Zuweisen der App Group erzeugen |
| Target- oder Projektnamen ändern sich nach SDK-Update (`ExpoWidgetsTarget`, `Pondus`) | Signing-Schritt findet das Target nicht | Prüfschritt bricht früh mit klarer Meldung ab; Namen stehen zentral im Workflow |
| `expo-widgets` im Release-Build | Live Activity fehlt | im Spike (25.10.2026) mit lokalem Release-Build bestätigt; Testplan prüft es auf jedem neuen SDK |
| Runner-Image wechselt Xcode oder entfernt 26.6 | Build bricht | Xcode per `DEVELOPER_DIR` gepinnt, Prüfschritt meldet fehlende Version; Wechsel auf Xcode 27 bewusst vor April 2027 |
| Expo-SDK-Update bricht Prebuild/Pods | Build bricht | SDK-Updates erst lokal bauen, dann CI mit `upload = false` |
| 14 GB SSD auf dem Runner knapp | Archive bricht mit „No space left“ | kein DerivedData-Cache; bei Bedarf vorab große Simulator-Runtimes löschen (`xcrun simctl runtime delete`) |
| Zertifikat oder Profile laufen ab (26.10.2027) | Signing schlägt fehl | Ablaufdatum steht im Log; Kalendererinnerung, Erneuerung siehe Phase 1 |
| Team hat höchstens 3 Distribution-Zertifikate, geteilt mit studypilot | neues Zertifikat lässt sich nicht anlegen | Vor dem Widerrufen prüfen, welche Profile ein Zertifikat nutzen; studypilot-Zertifikate nicht anfassen |
| TestFlight-Build läuft nach 90 Tagen ab | App startet nicht mehr | Workflow manuell neu starten |
| App-Name im Store vergeben | App-Eintrag lässt sich nicht anlegen | anderen Store-Namen wählen, Anzeigename bleibt „Pondus“ |
| `altool --upload-app` wird abgekündigt | Upload bricht | Ersatz: `fastlane pilot upload --api_key_path` oder Transporter |
| Öffentliches Repo | Secrets könnten über manipulierte Workflows abfließen | nur `workflow_dispatch`/Tags, Environment auf `main` und `ios-v*` beschränkt, keine Artefakte |
| Backend nur im Tailnet | App ohne Tailscale nutzlos, externe Tester schwierig | so gewollt; vor externen Testern Backend-Erreichbarkeit klären |
| JS-Update mit nativer Abhängigkeit (Phase 4) | Absturz beim Start | `fingerprint`-Runtime; `expo-updates` rollt nach Fehlern zurück |

## 8. Testplan

| Fall | Erwartung |
| --- | --- |
| Workflow ohne Secrets (z. B. in einem Fork) | Job startet nicht bzw. bricht in „Voraussetzungen prüfen“ ab, nichts wird signiert oder hochgeladen |
| Lauf mit `upload = false` | `.ipa` wird erzeugt, Entitlement-Prüfung für App und Extension grün |
| Lauf mit Upload | Build erscheint in App Store Connect → TestFlight mit Version und Build-Nummer aus dem Lauf, ohne Exportfrage |
| Installation über TestFlight | App startet, Login gegen die API im Tailnet funktioniert |
| Update über TestFlight | höhere Build-Nummer ersetzt die alte, lokale Daten (SQLite, SecureStore) bleiben |
| Wechsel lokaler Dev-Build ↔ TestFlight | gleiche Bundle-ID, die Installation ersetzt die andere. Kurz prüfen, dass Login und Daten erhalten bleiben |
| Live Activity im TestFlight-Build | Start, Sperrbildschirm, Dynamic Island und Buttons wie in `LIVE_ACTIVITIES.md`, Abschnitt 10 |
| Notifications | Pausen-Benachrichtigung kommt |
| Tailscale aus | verständliche Offline- bzw. Fehleranzeige, kein Absturz |
| Phase 4: JS-Update | Änderung erscheint nach dem zweiten Start, Dev-Client unbeeinflusst |

## 9. Offene Fragen

1. ~~Apple-Konto: Individual oder Organisation?~~ Organisation (studypilot UG), geklärt am 26.10.2026.
2. ~~Rolle des API Keys~~: App Manager für die CI, Admin nur für die Einrichtung.
3. ~~Push Notifications in der App-ID~~: Push ist aktiv. `expo-notifications` setzt standardmäßig `aps-environment`, das App-Store-Profil enthält `production`.
4. **Tester außer Julian?** Falls ja: interne Tester brauchen einen App-Store-Connect-Zugang, externe eine Beta-Review. Alle brauchen Tailscale.
5. **Trigger:** nur manuell und per Tag (Entwurf) oder zusätzlich bei jedem Merge auf `main`, wenn sich `apps/mobile/**` oder `packages/shared/**` ändert? Kostet nichts, erzeugt aber viele TestFlight-Builds.
6. **Phase 4 umsetzen?** Hängt davon ab, wie oft kleine JS-Korrekturen schnell aufs iPhone sollen.

## Quellen

Abgerufen am 25.10.2026.

- Apple: [TestFlight-Überblick](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview), [Builds hochladen](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds), [App Store Connect API](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api), [API Keys erstellen](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api), [Upcoming Requirements (Xcode 26 seit 28.04.2026, iOS-27-SDK ab April 2027)](https://developer.apple.com/news/upcoming-requirements/), [Geräte registrieren (100 pro Familie und Jahr)](https://developer.apple.com/help/account/devices/devices-overview), [Enterprise-Programm](https://developer.apple.com/programs/enterprise/)
- Apple-Forum: [Cloud Signing braucht Admin-Key](https://developer.apple.com/forums/thread/698117), [OTA-Update hängt auf iOS 26](https://developer.apple.com/forums/thread/847091), [Xcode 13 Cloud Signing, privater Schlüssel fehlt](https://developer.apple.com/forums/thread/695759)
- GitHub: [Abrechnung Actions (öffentliche Repos kostenlos, macOS $0,062/min)](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [GitHub-hosted Runner (macos-26: M1, 3 Kerne, 7 GB, 14 GB SSD)](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [macOS-26-arm64-Image 20261013 (Xcode 26.6, fastlane, xcbeautify)](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md), [Xcode-Apps in Actions signieren](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications), [Xcode-27-Preview-Images](https://newreleases.io/project/github/actions/runner-images/release/xcode-27-arm64%2F20260805.0079)
- Expo: [Preise](https://expo.dev/pricing), [Pläne und Free-Limits](https://docs.expo.dev/billing/plans/), [SDK 58 (15.10.2026)](https://expo.dev/changelog/sdk-58), [App Extensions in EAS Build](https://docs.expo.dev/build-reference/app-extensions/), [iOS Capabilities](https://docs.expo.dev/build-reference/ios-capabilities/), [Lokale EAS-Builds](https://docs.expo.dev/build-reference/local-builds/), [EAS Submit iOS](https://docs.expo.dev/submit/ios/), [TestFlight mit Expo](https://docs.expo.dev/submit/testflight/), [expo-updates SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/updates/), [Runtime-Versionen](https://docs.expo.dev/eas-update/runtime-versions/), [EAS Update im Dev-Client](https://docs.expo.dev/eas-update/expo-dev-client/), [Eigener Updates-Server](https://docs.expo.dev/eas-update/custom-updates-server), [Mindest-SDK 26 für App Store Connect](https://expo.dev/blog/app-store-connect-minimum-sdk-26)
- Forum Expo: [Wartezeiten im Free-Plan](https://forums.expo.dev/t/eas-build-wait-time/66715)
