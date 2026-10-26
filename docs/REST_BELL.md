# Glocke am Pausenende

Stand: 26.10.2026.

Ziel: Mit Kopfhörern hört man am Ende der Satzpause eine Glocke und muss nicht aufs iPhone schauen. Ohne Kopfhörer bleibt alles wie bisher: lokale Notification „Pause vorbei“ und Haptik. Die Live Activity bleibt unverändert.

## 1. Problem

Während der Pause ist Pondus meist im Hintergrund oder das iPhone ist gesperrt. iOS suspendiert eine App im Hintergrund nach wenigen Sekunden, und eine suspendierte App kann keinen Ton abspielen. Ein JS-Timer reicht also nicht.

## 2. Optionen

| Option | Bewertung |
| --- | --- |
| **1. Hintergrund-Audio-Session** (`.playback`, `UIBackgroundModes: audio`) | Mit aktiver Session, die gerade abspielt, läuft die App im Hintergrund und bei gesperrtem iPhone weiter. Die Glocke kommt dann sekundengenau und unabhängig von Fokus und Benachrichtigungseinstellungen. Die Kategorie `.playback` ignoriert den Stummschalter. Das ist hier gewollt und spielt keine Rolle, weil die Glocke nur über Kopfhörer kommt. Mit `.mixWithOthers` laufen Spotify und Podcasts weiter und bleiben die „Now Playing“-App. Einschränkungen: iOS lässt eine App Audio **nicht aus dem Hintergrund starten** (`cannotStartPlaying`, `!pla`). Die Session muss also im Vordergrund beginnen und dann am Leben bleiben. Ein Anruf unterbricht sie. Außerdem besteht ein App-Review-Risiko, siehe 4. |
| **2. Notification mit eigenem Sound** (`sounds` im expo-notifications-Plugin, `.wav`/`.aiff`/`.caf`, max. 30 s) | Funktioniert auch bei beendeter App, und iOS spielt den Ton über verbundene Kopfhörer. Aber der Stummschalter unterdrückt Notification-Töne, ebenso Fokus und die Benachrichtigungseinstellungen. Die Lautstärke folgt der Klingellautstärke. Es erscheint immer ein Banner. Ein Signal, auf das man sich ohne Blick aufs iPhone verlässt, ist das nicht. Als Fallback reicht es. |
| **3. Kombination** | **Gewählt.** Die Audio-Session spielt die Glocke. Die Notification bleibt als Sicherheitsnetz geplant, kommt mit der Glocke als Ton und wird erst entfernt, wenn die Glocke wirklich spielt. |

Weitere Optionen: **AlarmKit** (iOS 26) setzt sich über Stummschalter und Fokus hinweg, bringt aber eine eigene Alarm-UI und eine zweite Live Activity mit. Für eine Pause alle zwei Minuten ist das zu schwer, siehe LIVE_ACTIVITIES.md 9. Eine **Time-Sensitive-Notification** braucht ein Entitlement und hilft nicht gegen den Stummschalter.

## 3. Umsetzung

### Natives Modul `apps/mobile/modules/rest-bell`

Ein kleines lokales Expo-Modul in Swift (`RestBellModule.swift`), das aus `modules/` automatisch gelinkt wird. Es braucht kein `package.json`.

- `headphonesConnected()`: `AVAudioSession.currentRoute.outputs` enthält `.headphones`, `.bluetoothA2DP`, `.bluetoothLE`, `.bluetoothHFP` oder `.usbAudio`. AirPods melden bei Wiedergabe A2DP. Nicht dazu zählen AirPlay, CarPlay, HDMI und der Lautsprecher. Bluetooth-Lautsprecher kann iOS nicht von Kopfhörern unterscheiden, sie zählen also mit.
- `arm(endsAt, volume, notificationId, lingerMs)`: Startet die Session (`.playback` + `.mixWithOthers`) mit einer stillen Schleife (0,5 s WAV im Speicher). Danach stellt es einen Wall-Clock-Timer (`DispatchSourceTimer`, `wallDeadline`) auf `endsAt`.
- Zum Zeitpunkt `endsAt` prüft das Modul die Kopfhörer erneut. Sind keine verbunden, bleibt die Glocke aus, damit sie nicht über den Lautsprecher kommt. Ist der Timer mehr als 1,5 s zu spät dran (App war suspendiert), bleibt sie ebenfalls aus. Sonst spielt es `rest-bell.wav`. Erst wenn `play()` erfolgreich war, entfernt das Modul die ausstehende Notification nativ über `UNUserNotificationCenter`, ohne Umweg über JS.
- Die Session bleibt nach der Glocke oder nach „Pause überspringen“ noch **10 Minuten** aktiv. Dadurch lässt sich auch eine Pause scharf schalten, die per „Satz ✓“ aus der Live Activity bei gesperrtem iPhone startet. Ohne diese Nachlaufzeit müsste iOS die Session aus dem Hintergrund neu starten, und das verbietet es. Nach 10 Minuten ohne neue Pause endet die Session. Ist der Schalter aus, endet sie sofort (`release()`).
- Nach einer Unterbrechung (Anruf, Siri) versucht das Modul die Session wieder zu starten. Nach einem Media-Services-Reset baut es die Player neu auf. Bei einem Wechsel der Audio-Route meldet es `onRouteChange` an JS.
- Die Glocke liegt im App-Bundle, weil das expo-notifications-Plugin sie über `sounds` dorthin kopiert. Notification und Modul nutzen dieselbe Datei.

### Logik `apps/mobile/src/services/rest-alert.ts`

Rein und mit Jest getestet (`__tests__/rest-alert.test.ts`):

1. **Zuerst die Glocke scharf schalten**, wenn der Schalter an ist, die Datei da ist und Kopfhörer verbunden sind. Die Reihenfolge ergibt sich daraus, dass Zeitpunkt und Ton der Notification davon abhängen, ob das geklappt hat.
2. **Dann die Notification planen**, mit fester ID `rest-end-<endsAt>`:
   - Glocke scharf: Notification bei `endsAt + 3 s` mit Glocken-Ton. Spielt die Glocke, entfernt das Modul sie vorher. Spielt sie nicht (App beendet, Anruf, Kopfhörer weg), kommt die Notification 3 s später statt gar nicht.
   - Sonst: Notification bei `endsAt` mit Standardton wie bisher.
3. **Am Pausenende im UI-Tick** fällt die Notification nur weg, wenn die App im Vordergrund ist. Im Hintergrund läuft der Tick nur, weil die Session die App am Leben hält. Dann bleibt die Notification stehen: Entweder entfernt die Glocke sie, oder sie ist der Alarm. Der natürliche Ablauf (`finish`) schaltet die Glocke nicht ab, nur „Pause überspringen“ und „Pause anhalten“ tun das.

Warum nicht die Notification stumm schalten, sobald die Glocke scharf ist? Dann gäbe es bei einer beendeten App mit Kopfhörern gar kein hörbares Signal. Eine kurze Verzögerung ist das kleinere Übel.

Werden Kopfhörer während der Pause auf- oder abgesetzt oder ändern sich die Einstellungen, plant `rescheduleEnd()` beides neu. Weil die ID gleich bleibt, ersetzt iOS die ausstehende Notification. Unabhängig davon prüft das Modul die Kopfhörer zum Zeitpunkt `endsAt` noch einmal.

### Einstellungen

Profil → Pausentimer: „Glocke am Pausenende“ (Standard an) mit Lautstärke Leise/Mittel/Laut (0,5/0,8/1,0, relativ zur Systemlautstärke, Standard Laut) und „Musik leiser bei der Glocke“ (Standard an).

Nachtrag 26.10.2026: Über Musik war die Glocke leicht zu überhören. Deshalb ist sie jetzt lauter (siehe Glocken-Sound), der Standard steht auf „Laut“, und eine Settings-Migration (v1) hebt den alten Standard 0,7 auf 1,0. Außerdem kann Pondus die Musik für die Dauer der Glocke dämpfen.

### Musik dämpfen (Ducking)

Während der Pause läuft die Session nur mit `.mixWithOthers`, die Musik bleibt also unverändert. Zum Pausenende geht es so weiter:

1. Category auf `.mixWithOthers` + `.duckOthers` setzen und die Session erneut aktivieren. iOS blendet andere Audio-Apps dann über einige hundert ms herunter.
2. Die Glocke startet 0,35 s später (`play(atTime:)`), wenn die Musik schon leiser ist.
3. 0,4 s nach dem Ende der Glocke wird die Stille-Schleife pausiert, die Session mit `.notifyOthersOnDeactivation` deaktiviert und sofort wieder gestartet. Nur so hebt iOS das Ducking wieder auf.
4. Klappt der Neustart nicht (iOS erlaubt Audio-Start nur, solange die App noch läuft), endet die Session. Die nächste Pause aus der Live Activity bekommt dann nur die Notification, bis wieder eine Pause in der App startet. Klappt das Ducking selbst nicht, spielt die Glocke ohne.

### Glocken-Sound

`apps/mobile/assets/sounds/rest-bell.wav` (2,4 s, 44,1 kHz, 16 Bit, mono, 207 KB) wird mit `node apps/mobile/scripts/generate-rest-bell.mjs` synthetisch erzeugt: additive Synthese aus zehn inharmonischen Glocken-Teiltönen auf A5 (880 Hz), jeder mit eigenem exponentiellem Abklingen, zweimal angeschlagen („ding – ding“), damit sie sich von Musik abhebt. Lange Ausklingzeit des Grundtons und eine weiche Sättigung (tanh) heben den Ausklang an, Spitze bei −0,3 dBFS. Das ergibt etwa −10 dB RMS statt vorher −16 dB, also rund 6 dB lauter bei gleicher Spitze. Es ist eigenes Werk ohne fremde Samples, gemeinfrei (CC0).

## 4. Risiken

- **App Review 2.5.4:** „Multitasking apps may only use background services for their intended purposes: VoIP, audio playback, …“. Apps, die stille Audiodaten nur abspielen, um wach zu bleiben, werden abgelehnt. Pondus spielt ein hörbares Signal zum Pausenende, wie Intervall-Timer. Die stille Schleife läuft nur mit Kopfhörern, bei eingeschalteter Glocke und begrenzt auf die Pause plus 10 Minuten. In die Review-Notes gehört: „Pausentimer spielt bei verbundenen Kopfhörern am Ende jeder Satzpause eine Glocke, auch bei gesperrtem iPhone. Einstellungen → Pausentimer → Glocke am Pausenende.“ Wird das trotzdem abgelehnt, bleibt der Schalter standardmäßig aus oder fällt weg. Die Notification mit Glocken-Ton (Option 2) funktioniert ohne Background-Audio weiter.
- **Akku:** Eine aktive Ausgabe hält Audio-Hardware und Bluetooth-Link wach. Der Aufwand liegt in der Größenordnung von Musikhören bei ausgeschaltetem Display, und hört man ohnehin Musik, ist der Link schon aktiv. Begrenzt ist das auf Pausen plus 10 Minuten. Im Gerätetest messen (Testplan Punkt 12).
- **Hintergrundstart:** Ist die App beendet oder war die Session abgelaufen (mehr als 10 Minuten ohne Pause) und startet die Pause aus der Live Activity, gibt es keine Glocke, nur die Notification. Sobald die App einmal im Vordergrund eine Pause gestartet hat, klappt es wieder.
- **AirPods-Umschaltung:** Eine aktive Session könnte die automatische Geräteumschaltung der AirPods beeinflussen (iPhone „spielt“). Auf dem Gerät beobachten.
- **Andere Audio-Module:** Kommt später expo-audio oder expo-video dazu, teilen sie sich dieselbe `AVAudioSession`. Dann die Kategorie abstimmen.

## 5. Testplan am iPhone

Voraussetzung: neuer Dev-Build oder TestFlight-Build am Mac (`pnpm --filter @pondus/mobile prebuild`, dann Xcode). Das native Modul ist auf dem Pi nicht gebaut worden. Pause jeweils auf 30 bis 60 s stellen, Glocke an, Benachrichtigungen an.

| # | Situation | Erwartung |
| --- | --- | --- |
| 1 | AirPods verbunden, App im Vordergrund | Glocke in den AirPods bei 0:00, Haptik, kein Banner |
| 2 | AirPods, App im Hintergrund (Home-Bildschirm) | Glocke bei 0:00, **keine** Notification danach |
| 3 | AirPods, iPhone gesperrt, Live Activity sichtbar | Glocke bei 0:00, keine Notification. Die Live Activity wechselt ohne Öffnen der App auf „Satz ✓“, weil die App wach ist. Falls nicht, zeigt sie wie bisher „Pause vorbei“, das ist kein Fehler. |
| 4 | Wie 3, Spotify spielt Musik, „Musik leiser“ aus | Musik läuft während der Pause ohne Unterbrechung oder Ducking weiter, die Glocke ist über der Musik gut hörbar, Spotify bleibt auf dem Sperrbildschirm „Now Playing“ |
| 5 | Wie 3, Stummschalter an (Ring/Silent auf stumm) | Glocke trotzdem in den AirPods |
| 6 | Keine Kopfhörer, App im Hintergrund | Wie bisher: Notification „Pause vorbei“ bei 0:00 mit Standardton, keine Glocke über den Lautsprecher |
| 7 | AirPods, Pause läuft, AirPods während der Pause ins Case legen | Keine Glocke über den Lautsprecher. Notification bei 0:00 mit Standardton. |
| 8 | Ohne Kopfhörer Pause starten, iPhone sperren, nach 5 s AirPods verbinden | Glocke bei 0:00, keine Notification. Ist die App schon suspendiert, kommt nur die Notification, das ist akzeptiert. |
| 9 | AirPods, gesperrt: per Live Activity „Satz ✓“ eine Pause starten (direkt nach einer Glocke) | Auch diese Pause endet mit der Glocke |
| 10 | Wie 9, aber App vorher in der App-Übersicht beenden | Keine Glocke, Notification kommt etwa 0 bis 3 s nach 0:00 |
| 11 | AirPods, während der Pause Anruf annehmen und vor 0:00 beenden | Glocke oder spätestens 3 s danach die Notification, nie beides doppelt |
| 12 | 45 min Workout mit AirPods, gesperrt | Akkuverbrauch im Vergleich zu einem Workout mit ausgeschalteter Glocke notieren (Einstellungen → Batterie) |
| 13 | „Pause überspringen“ (App oder Live Activity), „−15/+15“, Pause anhalten und fortsetzen | Glocke kommt nur zum neuen Ende bzw. gar nicht, keine verwaiste Notification |
| 14 | Glocke in den Einstellungen ausschalten während einer Pause | Keine Glocke, Notification bei 0:00 mit Standardton |
| 15 | Lautstärke Leise/Mittel/Laut | Hörbarer Unterschied, „Laut“ ist über Musik nicht unangenehm |
| 16 | Wired/USB-C-Kopfhörer, Bluetooth-Lautsprecher | Glocke über das Gerät (Lautsprecher zählt mit, siehe 3) |
| 17 | 10 min nach der letzten Pause | Audio-Session beendet (kein Pondus mehr in Kontrollzentrum/Audio-Indikatoren, App suspendiert) |
| 18 | Spotify spielt, „Musik leiser bei der Glocke“ an, iPhone gesperrt | Musik wird kurz vor der Glocke leiser, die Glocke ist deutlich hörbar, danach kommt die Musik auf volle Lautstärke zurück (nicht dauerhaft gedämpft, Spotify pausiert nicht) |
| 19 | Wie 18, danach direkt per Live Activity „Satz ✓“ eine weitere Pause | Auch diese Pause endet mit Glocke und Ducking, d. h. der Session-Neustart nach dem Ducking hat im Hintergrund geklappt |
| 20 | Podcast statt Musik, „Musik leiser“ an | Podcast wird gedämpft, nicht pausiert, und läuft danach normal weiter |

## 6. Quellen

- Apple, App Review Guidelines 2.5.4: https://developer.apple.com/app-store/review/guidelines/
- Apple, Configuring your app for media playback: https://developer.apple.com/documentation/avfoundation/configuring-your-app-for-media-playback
- Apple, Handling audio interruptions: https://developer.apple.com/documentation/avfaudio/handling-audio-interruptions
- Apple, Responding to Route Changes (Audio Session Programming Guide, archiviert): https://developer.apple.com/library/content/documentation/Audio/Conceptual/AudioSessionProgrammingGuide/HandlingAudioHardwareRouteChanges/HandlingAudioHardwareRouteChanges.html
- Apple Developer Forums, Workout-Timer-Cues im Hintergrund, `cannotStartPlaying` beim Start aus dem Hintergrund, funktioniert nur bei bereits laufender Wiedergabe: https://developer.apple.com/forums/thread/791865
- Apple Developer Forums, `mixWithOthers` und `!pla` auf neueren iPhones: https://developer.apple.com/forums/thread/739647
- Apple Developer Forums, Ablehnungen nach 2.5.4 bei Background-Audio: https://developer.apple.com/forums/thread/826849
- Apple Developer Forums, Bluetooth-Porttypen unterscheiden nicht zwischen Kopfhörern und Lautsprechern: https://developer.apple.com/forums/thread/815255
- Apple iPhone-Benutzerhandbuch, Stummmodus unterdrückt Hinweistöne: https://help.apple.com/iphone/4/Contents/en/searchindex/iph3bd01398.html
- Expo SDK 58, expo-audio: https://docs.expo.dev/versions/v58.0.0/sdk/audio/. `interruptionMode`, `shouldPlayInBackground`, aber keine API für Ausgaberoute oder Route-Changes.
- Expo SDK 58, expo-notifications (`sounds`-Plugin-Option, eigener Sound): https://docs.expo.dev/versions/v58.0.0/sdk/notifications/

Community-Pakete (npm-Registry, abgefragt am 26.10.2026): `react-native-headphone-detection` letzte Version 1.3.0 vom 01.10.2020, `react-native-audio-session` 0.0.6 vom 17.03.2020, `react-native-headphone-detect-v2` 0.2.6-beta-1 (Beta mit Template-README). Alle drei sind unmaintained oder unreif und zudem keine Expo-Module. **expo-audio** wurde bewusst nicht ergänzt: Es bietet keine Route-Erkennung, und eine Glocke nach Plan im Hintergrund hinge an JS-Timern. Außerdem würden zwei Verwalter derselben `AVAudioSession` gegeneinander arbeiten. Das eigene Modul hat etwa 300 Zeilen Swift und macht alles an einer Stelle.
