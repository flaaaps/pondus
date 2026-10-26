# Pondus – Server-Deployment über GitHub Actions und GitHub Packages

Stand: 26.10.2026. Status: ✅ in Betrieb seit 26.10.2026 (Phasen 1–3), Freigabe-Reviewer am Environment optional. Workflow: `.github/workflows/api-image.yml`, Pi-Seite: `deploy/pi/`.

Ziel: Nach einem Merge auf `main` landet die API ohne Handarbeit auf dem Raspberry Pi. Heute baut Claude oder Julian das Image auf dem Pi selbst (`podman compose build`), und jeder vergessene Schritt fällt erst auf, wenn die App nicht mehr synchronisiert. Genau das ist am 26.10. passiert: PR 2 war gemerged, die App schon damit gebaut, die API auf dem Pi noch auf dem Stand vom Vortag.

**Empfehlung in einem Satz:** GitHub Actions baut das Image auf einem nativen arm64-Runner, testet vorher, veröffentlicht es in GitHub Packages (`ghcr.io/flaaaps/pondus-api`) und markiert es als `:prod`; der Pi zieht es selbständig per `podman auto-update` als systemd-Dienst, mit Health-Check und automatischem Rollback.

## 1. Ausgangslage

| Punkt | Stand |
| --- | --- |
| Server | Raspberry Pi 5 (aarch64, 8 GB, SD-Karte), Debian 13, nur Nutzer `pi` ohne sudo. Rootless Podman 5.4.2 mit netavark, cgroups v2, Linger aktiv, Quadlet vorhanden (`/usr/libexec/podman/quadlet`) |
| Stack heute | `docker-compose.yml` mit podman-compose 1.6: `pondus_db_1` (postgres:17-alpine, Volume `pondus_pgdata`) und `pondus_api_1` (lokal gebautes `localhost/pondus-api:latest`), Port nur auf `127.0.0.1:4010` |
| Erreichbarkeit | nur im Tailnet über `tailscale serve` (`https://jupi.tail0ee0a3.ts.net:4010` → `127.0.0.1:4010`). Keine öffentliche Adresse, kein Weg von außen auf den Pi |
| Secrets | `~/projects/pondus/.env` auf dem Pi (`POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`), nicht im Repo. Die App-Secrets der iOS-Pipeline liegen in Infisical (Projekt „studypilot“) und GitHub-Environment `testflight` |
| Image | `apps/api/Dockerfile`: Multi-Stage auf `node:24-alpine`, esbuild-Bundle, nur Prod-Dependencies, `USER node`. Migrationen und Seed laufen beim Containerstart (`node dist/db/migrate.js && node dist/db/seed.js && node dist/server.js`), beide idempotent |
| Deployment heute | manuell auf dem Pi: Backup, `podman compose build api`, `podman compose up -d --force-recreate --no-deps api`, Health prüfen, `podman image prune` |
| Repo | `github.com/flaaaps/pondus`, öffentlich. Actions: `web.yml` (GitHub Pages), `ios-testflight.yml` (TestFlight). Linux-arm64-Runner (`ubuntu-24.04-arm`) sind für öffentliche Repos kostenlos |
| Tests | `apps/api/test` mit Vitest und eingebettetem PostgreSQL (`embedded-postgres`, Prebuilt für linux-arm64 vorhanden) |

## 2. Wie kommt das Image auf den Pi?

Der Pi ist von GitHub aus nicht erreichbar. Vier Wege, die Entscheidung in 2.5.

### 2.1 Pull: `podman auto-update` mit Quadlet (empfohlen)

Der Pi fragt das Registry regelmäßig, ob hinter dem Tag `:prod` ein neuer Digest liegt, zieht ihn und startet den Container neu. Ohne Zugang von außen, ohne Secrets für GitHub, ohne zusätzlichen Dienst.

- **Quadlet:** Container als systemd-User-Units in `~/.config/containers/systemd/*.container`. Podman erzeugt daraus `pondus-db.service` und `pondus-api.service`. Start beim Boot über Linger, `Restart=always`, Logs in `journalctl --user`.
- **AutoUpdate=registry:** setzt das Label `io.containers.autoupdate=registry`. `podman auto-update` vergleicht den Digest, zieht bei Änderung und startet die Unit neu.
- **Rollback:** `Notify=healthy` lässt systemd erst dann „gestartet“ melden, wenn der Health-Check (`/health`) grün ist. Wird der neue Container nicht gesund, schlägt der Neustart fehl und `podman auto-update` setzt das vorherige Image wieder ein (`--rollback` ist Standard).
- **Takt:** `podman-auto-update.timer` läuft standardmäßig täglich; die Override-Datei in `install.sh` stellt ihn auf alle 5 Minuten. Eine Abfrage ist ein HEAD-Request auf das Manifest, Datenverkehr nur bei Änderung.
- **Grenze:** maximal 5 Minuten Verzögerung, und GitHub weiß nicht, wann der Pi gezogen hat. Für Pondus reicht das; eine Sofort-Variante steht in 2.4.

### 2.2 Push per SSH über Tailscale

Der Workflow tritt mit `tailscale/github-action` als ephemerer Knoten ins Tailnet ein und führt per SSH `podman auto-update` (oder `systemctl --user restart`) auf dem Pi aus. Braucht einen Tailscale-OAuth-Client (Secret in GitHub), ACL-Tags für CI-Knoten, einen SSH-Schlüssel für `pi` (Secret) und Tailscale-SSH oder sshd auf dem Pi. Vorteil: sofort und im Actions-Log sichtbar. Nachteil: vier weitere Secrets und ein Zugang ins Heimnetz, dessen Reichweite ein kompromittierter Workflow hätte. Nur als Zusatz zu 2.1 sinnvoll (Auslöser statt Transport).

### 2.3 Self-hosted Runner auf dem Pi

Ein GitHub-Actions-Runner (arm64) auf dem Pi, der Deploy-Job läuft direkt dort. GitHub rät bei **öffentlichen** Repos ausdrücklich davon ab: Workflows aus Fork-PRs könnten Code auf dem Runner ausführen. Runner-Gruppen mit Einschränkungen gibt es nur für Organisationen. Dazu ein dauerhaft laufender Prozess (etwa 150 MB RAM) auf einem Host, der sich den Speicher mit Home Assistant teilt. ❌

### 2.4 Webhook

Der Pi stellt einen Endpunkt bereit (über Tailscale Funnel oder cloudflared), den der Workflow nach dem Push aufruft; ein kleiner Dienst prüft die Signatur und startet `podman auto-update`. Öffnet eine öffentliche Adresse auf den Pi und braucht einen eigenen Dienst nur für das Signal. Einziger Gewinn gegenüber 2.1: Sekunden statt Minuten. ❌ als Hauptweg; T3 Code hätte dafür bereits einen Webhook-Scheduler, falls die Verzögerung je stört.

### 2.5 Entscheidung

| Weg | Latenz | Secrets/Zugänge | Dauerprozesse | Rollback | Bewertung |
| --- | --- | --- | --- | --- | --- |
| **Pull, auto-update** | ≤ 5 min | keine (öffentliches Package) | nur systemd-Timer | eingebaut | ✅ Hauptweg |
| Push per SSH | sofort | Tailscale-OAuth, SSH-Key, ACL | keine | manuell/Script | Zusatz, Phase 4 |
| Self-hosted Runner | sofort | Runner-Token | Runner | manuell | ❌ öffentliches Repo |
| Webhook | sofort | Signatur-Secret, Funnel | eigener Dienst | manuell | ❌ |

## 3. Pipeline in GitHub Actions

Datei: `.github/workflows/api-image.yml`.

### 3.1 Auslöser

| Ereignis | Was passiert |
| --- | --- |
| Pull Request mit Änderungen an `apps/api`, `packages/shared`, Lockfile, Dockerfile-Kontext | Test + Build ohne Push: Dockerfile-Fehler fallen vor dem Merge auf |
| Push auf `main` mit solchen Änderungen | Test, Build, Push als `sha-<commit>` und `main`, dann Job `promote` → `:prod` |
| Git-Tag `api-vX.Y.Z` | zusätzlich Tag `api-vX.Y.Z` im Registry, für Releases mit Namen |
| `workflow_dispatch` | Build eines beliebigen Standes; Eingabe `promote` steuert, ob `:prod` gesetzt wird |

Änderungen nur an `apps/mobile` oder `docs` lösen keinen Build aus.

### 3.2 Jobs

1. **test** auf `ubuntu-24.04-arm`: `pnpm install --filter @pondus/api...`, Typecheck für shared und api, Lint, `vitest` mit eingebettetem PostgreSQL. Läuft nativ auf arm64, also mit demselben Prebuilt wie später im Image.
2. **build** auf `ubuntu-24.04-arm`: `docker/build-push-action` für `linux/arm64`, kein QEMU. Build-Arg `APP_VERSION=<commit>` landet in `/health` als `version`. Layer-Cache über den GitHub-Actions-Cache (`type=gha`), damit nach dem ersten Lauf nur die geänderten Stages neu gebaut werden. Login mit `GITHUB_TOKEN` (`packages: write`), keine eigenen Secrets.
3. **promote** auf `ubuntu-latest`, Environment `production`: vergibt per `docker buildx imagetools create` den Tag `:prod` für den gerade gebauten Digest, ohne Neubau. Hat das Environment in den Repo-Einstellungen einen „Required reviewer“, wartet der Job auf Julians Freigabe; ohne Schutzregel läuft er sofort durch. So lässt sich später zwischen „jeder Merge geht live“ und „ich gebe frei“ umschalten, ohne den Workflow zu ändern.

### 3.3 Tags im Registry

| Tag | Bedeutung |
| --- | --- |
| `sha-abc1234` | unveränderlich, ein Tag pro Build. Für Rollbacks: `podman pull ghcr.io/flaaaps/pondus-api:sha-abc1234` und Unit umstellen, oder `:prod` im Registry zurücksetzen |
| `main` | letzter gebauter Stand von `main` |
| `prod` | der Stand, dem der Pi folgt |
| `api-v0.2.0` | Release-Tag, optional |

### 3.4 Sichtbarkeit des Packages

Das Repo ist öffentlich und das Image enthält keine Secrets (nur den gebauten Code, der ohnehin im Repo liegt). Empfehlung: Package **öffentlich** stellen (Package-Einstellungen → „Change visibility“ nach dem ersten Push). Dann braucht der Pi keinen Login und kein Token, das abläuft. Bleibt es privat, braucht der Pi einmalig `podman login ghcr.io` mit einem Fine-grained PAT (`read:packages`), der nach spätestens einem Jahr erneuert werden muss. Nicht vergessen: Nach dem ersten Push das Package mit dem Repo verknüpfen (geschieht automatisch über das `org.opencontainers.image.source`-Label, das `metadata-action` setzt).

## 4. Pi-Seite

Dateien in `deploy/pi/`:

| Datei | Zweck |
| --- | --- |
| `pondus.network` | eigenes Podman-Netz `pondus`; Container finden sich per Name (`pondus-db`) |
| `pondus-db.container` | PostgreSQL 17, bestehendes Volume `pondus_pgdata`, Health-Check `pg_isready`, **kein** AutoUpdate |
| `pondus-api.container` | `ghcr.io/flaaaps/pondus-api:prod`, `AutoUpdate=registry`, Port `127.0.0.1:4010`, Health-Check `/health`, `Notify=healthy`, startet nach der DB |
| `install.sh` | kopiert die Units nach `~/.config/containers/systemd/`, ergänzt `DATABASE_URL` in `.env` (aus `POSTGRES_PASSWORD`, ohne es auszugeben), stellt den Auto-Update-Timer auf 5 Minuten, legt ein wöchentliches `podman image prune` an, stoppt den compose-Stack und startet die Units |

Was sich für die Daten ändert: nichts. Das Volume `pondus_pondus_pgdata` wird weiterverwendet, die Datenbank läuft im selben Image weiter. `docker-compose.yml` bleibt für lokale Tests und als Fallback erhalten; `tailscale serve` zeigt weiter auf `127.0.0.1:4010`.

Migrationen laufen wie bisher beim Containerstart. Beim Rollback auf ein älteres Image bleiben neuere, additive Migrationen in der Datenbank stehen; das ist unkritisch, solange Migrationen nur hinzufügen (bisher alle). Eine Migration, die Spalten entfernt oder umbenennt, braucht ab jetzt die Regel „erst Code ausrollen, der ohne die Spalte auskommt, dann die Migration“.

## 5. Umsetzungsplan

### Phase 1 – Repo ✅ (26.10.2026)
- Workflow `api-image.yml`, Quadlet-Units und `install.sh` im Repo.
- `/health` liefert `version` (Commit), `Dockerfile` nimmt `APP_VERSION` als Build-Arg.

### Phase 2 – Erster Lauf und Package ⬜ (30 min, ohne Pi-Änderung)
1. Der erste Push auf `main` mit diesem Stand startet den Workflow. Prüfen: Tests grün auf arm64, Image gepusht, `promote` durch.
2. Package `pondus-api` unter github.com/flaaaps?tab=packages öffentlich stellen (siehe 3.4) und prüfen, dass es mit dem Repo verknüpft ist.
3. Vom Pi aus testen, ohne etwas zu ändern: `podman pull ghcr.io/flaaaps/pondus-api:prod` und `podman run --rm ghcr.io/flaaaps/pondus-api:prod node -e "console.log(process.env.APP_VERSION)"`.
4. Optional: Environment `production` → „Required reviewers: flaaaps“ setzen, wenn Freigaben gewünscht sind.

### Phase 3 – Pi umstellen ✅ (26.10.2026)
1. Backup: `podman exec pondus_db_1 pg_dump -U pondus -d pondus | gzip > ~/backups/pondus/pondus-$(date +%Y%m%d-%H%M%S)-pre-quadlet.sql.gz`.
2. `bash deploy/pi/install.sh` im Repo-Ordner. Das Script stoppt den compose-Stack und startet die Units; die API ist etwa 30 bis 60 Sekunden nicht erreichbar.
3. Prüfen: `systemctl --user status pondus-api`, `curl http://127.0.0.1:4010/health` zeigt die `version` des Commits, App am iPhone synchronisiert.
4. Probe des Update-Pfads: einen kleinen Commit auf `main` mergen, nach spätestens 5 Minuten `journalctl --user -u podman-auto-update` und `/health` prüfen.
5. Probe des Rollbacks (einmalig, bewusst): `:prod` im Registry auf ein kaputtes Image zeigen lassen ist unnötig riskant; stattdessen `podman auto-update --dry-run` ansehen und den Rollback-Pfad in der Doku belassen. Wer es sehen will: lokal ein Image mit `CMD ["false"]` bauen, als `:prod` taggen und `podman auto-update` laufen lassen.

### Phase 4 – Optional: sofortiges Deployment ⬜ (0,5 Tage)
Nur wenn 5 Minuten stören: `tailscale/github-action` mit OAuth-Client und Tag `tag:ci`, ACL erlaubt `tag:ci → jupi:22`, SSH-Key für `pi` als Secret, Schritt `ssh pi@jupi podman auto-update` am Ende von `promote`. Alternativ `t3`-Webhook.

### Phase 5 – Optional: Secrets aus Infisical ⬜ (0,5 Tage)
`.env` auf dem Pi durch `infisical run --projectId … --env prod -- podman …` ersetzen ist mit Quadlet unhandlich (`EnvironmentFile` erwartet eine Datei). Praktikabler: ein `pondus-env.service`, der vor dem Start per Infisical-Maschinenidentität die `.env` erzeugt. Lohnt sich erst, wenn mehr als ein Server die Secrets braucht.

## 6. Laufzeit und Kosten

| Schritt | Schätzung |
| --- | --- |
| Tests (arm64, embedded PostgreSQL) | 2 bis 4 min |
| Build mit warmem Cache | 2 bis 4 min, erster Lauf 6 bis 10 min |
| Promote | unter 1 min |
| Bis der Pi zieht | 0 bis 5 min, Neustart der API etwa 20 s |
| Kosten | 0 €: öffentliches Repo, Linux-Runner inklusive arm64 kostenlos; GitHub Packages für öffentliche Packages kostenlos |

Platz auf der SD-Karte: ein Image rund 250 MB. `podman auto-update` behält das vorherige Image für den Rollback; der wöchentliche Prune entfernt ältere.

## 7. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| arm64-Runner zeitweise knapp (Warteschlange) | Build dauert länger | Kein Problem für die Korrektheit; Fallback `ubuntu-latest` mit QEMU (`docker/setup-qemu-action`), etwa 3× langsamer |
| Neues Image startet nicht (Migration bricht ab, Bug) | API down | `Notify=healthy` + automatischer Rollback auf das vorherige Image; Migration bleibt unvollständig in der DB → bei Migrationen mit mehreren Statements Drizzle-Transaktion beachten (läuft in einer Transaktion) |
| App ist dem Server voraus (Sync-Mutation unbekannt) | Sync blockiert, wie am 26.10. | Dieser Plan: API-Deploy folgt dem Merge automatisch. Zusätzlich der Sync-Endpunkt: unbekannte Mutationen einzeln ablehnen statt den ganzen Batch (eigene Aufgabe) |
| Server ist der App voraus (inkompatible API-Änderung) | alte App bricht | API-Änderungen abwärtskompatibel halten, wie bisher; Versionsfeld in `/health` zeigt, was läuft |
| `:prod` zeigt auf ein Image, das für ein anderes Schema gebaut wurde (manuelles Retag) | Fehler beim Start | Retag nur über den Workflow; Rollback bevorzugt auf `sha-…`-Tags des Vortages |
| Package privat und Token abgelaufen | Pi zieht nichts mehr, läuft aber weiter | Package öffentlich (3.4) oder Erinnerung für den PAT |
| Timer läuft, aber `pi` ist ausgeloggt | Units stoppen | Linger ist aktiv (`loginctl show-user pi` → `Linger=yes`); `install.sh` prüft das |
| Registry nicht erreichbar | kein Update, kein Ausfall | Timer versucht es beim nächsten Lauf erneut |
| Zwei Merges kurz nacheinander | zwei Builds, der spätere gewinnt | `concurrency` pro Ref bricht den älteren Lauf ab; `:prod` zeigt immer auf den zuletzt freigegebenen Digest |

## 8. Testplan

- **CI:** PR mit absichtlichem Dockerfile-Fehler → Build-Job rot, kein Push. PR ohne API-Änderung → Workflow startet nicht.
- **Registry:** nach einem Merge existieren `sha-…`, `main` und `prod`; `prod` hat denselben Digest wie `sha-…` des Merges.
- **Pi:** `/health` zeigt den Commit; `journalctl --user -u podman-auto-update` protokolliert „Updated“; `podman ps` zeigt das neue Image; Volume `pondus_pgdata` unverändert (Nutzer, Workouts vorhanden).
- **Rollback:** Image mit fehlschlagendem Start als `:prod` → nach dem Timer-Lauf läuft weiter das alte Image, Journal zeigt „rolled back“.
- **Boot:** Pi neu starten → beide Units laufen, Tailscale-URL antwortet.
- **App:** Workout starten, Satz abhaken, Sync läuft; Live Activity und Notifications unverändert.

## 9. Offene Fragen

1. **Freigabe oder automatisch?** Vorschlag: zunächst automatisch (kein Reviewer am Environment), weil die App ohnehin aus `main` gebaut wird. Umschalten ist eine Repo-Einstellung.
2. **Package öffentlich?** Vorschlag: ja (3.4).
3. **Soll die iOS-Pipeline auf den API-Build warten?** Nicht nötig, solange die API abwärtskompatibel bleibt; das Risiko liegt in der Gegenrichtung, und die ist mit diesem Plan gelöst.
4. **PostgreSQL-Updates:** bleiben manuell (Minor-Updates: Image-Tag bewusst erhöhen, Major: Dump und Restore).

## Quellen

- Podman: [podman-auto-update](https://docs.podman.io/en/latest/markdown/podman-auto-update.1.html), [Quadlet / podman-systemd.unit](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html), [Rootless und Linger](https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md)
- GitHub: [Linux-arm64-Runner für öffentliche Repos](https://github.blog/changelog/2025-01-16-linux-arm64-hosted-runners-now-available-for-free-in-public-repositories-public-preview/), [Container-Registry (ghcr.io) und GITHUB_TOKEN](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [Sichtbarkeit von Packages](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility), [Self-hosted Runner und öffentliche Repos](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#hardening-for-self-hosted-runners), [Environments und Required reviewers](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
- Docker Actions: [build-push-action](https://github.com/docker/build-push-action), [metadata-action](https://github.com/docker/metadata-action), [GHA-Cache-Backend](https://docs.docker.com/build/cache/backends/gha/)
- Tailscale: [GitHub Action](https://github.com/tailscale/github-action)
