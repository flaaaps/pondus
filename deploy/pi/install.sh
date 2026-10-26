#!/usr/bin/env bash
# Richtet den Pondus-Stack als systemd-User-Units (Quadlet) auf dem Pi ein und ersetzt den
# podman-compose-Stack. Einmalig als Nutzer `pi` ausführen, kein sudo nötig:
#   bash deploy/pi/install.sh
# Idempotent: erneutes Ausführen aktualisiert nur die Unit-Dateien.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
UNITS="$HOME/.config/containers/systemd"
ENV_FILE="$REPO/.env"
IMAGE="ghcr.io/flaaaps/pondus-api:prod"

[ -f "$ENV_FILE" ] || { echo "Fehlt: $ENV_FILE (POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)"; exit 1; }
command -v podman >/dev/null || { echo "podman fehlt"; exit 1; }
[ -x /usr/libexec/podman/quadlet ] || [ -x /usr/lib/podman/quadlet ] || { echo "Quadlet fehlt (podman >= 4.4 nötig)"; exit 1; }
loginctl show-user "$USER" 2>/dev/null | grep -q 'Linger=yes' || echo "Hinweis: 'loginctl enable-linger $USER' (einmalig mit sudo), sonst stoppt der Stack beim Logout."

# DATABASE_URL in .env ergänzen, ohne das Passwort auszugeben.
if ! grep -q '^DATABASE_URL=' "$ENV_FILE"; then
  pw="$(grep '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
  [ -n "$pw" ] || { echo "POSTGRES_PASSWORD fehlt in .env"; exit 1; }
  printf 'DATABASE_URL=postgres://pondus:%s@pondus-db:5432/pondus\n' "$pw" >> "$ENV_FILE"
  echo "DATABASE_URL in .env ergänzt."
fi
chmod 600 "$ENV_FILE"

# Unit-Dateien installieren.
mkdir -p "$UNITS"
cp "$REPO/deploy/pi/pondus.network" "$REPO/deploy/pi/pondus-db.container" "$REPO/deploy/pi/pondus-api.container" "$UNITS/"

# Timer: alle 5 Minuten nach einem neuen :prod-Image schauen (Standard wäre täglich).
mkdir -p "$HOME/.config/systemd/user/podman-auto-update.timer.d"
cat > "$HOME/.config/systemd/user/podman-auto-update.timer.d/override.conf" <<'CONF'
[Timer]
OnCalendar=
OnCalendar=*:0/5
RandomizedDelaySec=30
CONF

# Alte Images nach Updates aufräumen (SD-Karte): wöchentlich, nur ungetaggte/unbenutzte.
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/pondus-image-prune.service" <<'UNIT'
[Unit]
Description=Pondus: unbenutzte Container-Images entfernen
[Service]
Type=oneshot
ExecStart=/usr/bin/podman image prune -f
UNIT
cat > "$HOME/.config/systemd/user/pondus-image-prune.timer" <<'UNIT'
[Unit]
Description=Pondus: wöchentliches Image-Prune
[Timer]
OnCalendar=Sun 04:00
Persistent=true
[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload

# Erstes Image holen (öffentliches Package: kein Login nötig; privat: vorher `podman login ghcr.io`).
podman pull "$IMAGE"

# compose-Stack anhalten (Volume bleibt), dann Units starten.
if podman container exists pondus_api_1 2>/dev/null; then
  echo "Stoppe podman-compose-Stack (Volume pondus_pgdata bleibt erhalten) …"
  (cd "$REPO" && podman compose down) || true
fi
# Quadlet-Units sind generiert: kein enable (WantedBy steht in der Unit), nur start.
systemctl --user start pondus-db.service
systemctl --user start pondus-api.service
systemctl --user enable --now podman-auto-update.timer pondus-image-prune.timer

echo
echo "Status:"
systemctl --user --no-pager status pondus-db.service pondus-api.service | grep -E "●|Active" || true
curl -sf http://127.0.0.1:4010/health && echo || echo "Health noch nicht erreichbar – 'journalctl --user -u pondus-api -f'"
