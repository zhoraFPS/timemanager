# VfL Zeitspiel — Betriebs-Handbuch

Self-hosted Setup auf eigenem Server via Docker + Portainer.

---

## 1. Architektur

```
Host (Linux, Portainer)
├── Docker-Netzwerk
│   ├── db (Postgres 16)          Volume: postgres_data
│   ├── app (Next.js standalone)  Image: vfl-zeitspiel:latest
│   ├── proxy (Caddy)             optional — Let's Encrypt
│   └── backup (pg_dump)          optional — taeglicher Snapshot
└── /backups  ←  Bind-Mount fuer DB-Dumps
```

Alle Container werden ueber `docker-compose.yml` definiert und ueber Portainer-Stacks verwaltet. Das App-Image wird via CI oder manuell gebaut.

---

## 2. Erststart

```bash
# 1. Clone + .env vorbereiten
cp .env.example .env
# alle geforderten Werte ausfuellen — Secrets mit `openssl rand -hex 32` erzeugen

# 2. Image bauen
docker compose build

# 3. Datenbank + App starten
docker compose up -d db app

# 4. Optional: Reverse-Proxy (Caddy mit auto-TLS)
docker compose --profile proxy up -d proxy

# 5. Optional: Backup-Container (taeglicher pg_dump um 03:00)
docker compose --profile backup up -d backup

# 6. Seed (einmalig) — admin@firma.de / admin123
docker compose exec app npx prisma db seed
```

Die App erreicht die DB ueber das interne Compose-Netzwerk — Port 5432 wird **nicht** nach aussen gemappt. Einzig Port 3000 (direkt) oder 80/443 (via Caddy) stehen offen.

### Entrypoint-Verhalten
Beim Start jedes App-Containers:
1. Wartet auf DB-Erreichbarkeit (max 60s).
2. Fuehrt `prisma migrate deploy` idempotent aus.
3. Startet Next.js-Server auf Port 3000.

Rolling-Updates sind dadurch safe — keine separate Migrations-Stufe noetig.

---

## 3. Zwingende Env-Vars

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | wird aus POSTGRES_* zusammengesetzt in compose |
| `AUTH_SECRET` | min 32 Zeichen random |
| `NEXTAUTH_SECRET` | gleiche Laenge |
| `NEXTAUTH_URL` | `https://zeitspiel.deine-domain.de` |
| `CRON_SECRET` | random; schuetzt Auto-Clockout-Endpoint |
| `TZ` | **`Europe/Berlin`** — schon in compose gesetzt |
| `POSTGRES_PASSWORD` | random, min 20 Zeichen |

### Optional
| Variable | Wenn aktiv |
|---|---|
| `VAPID_*` | Web-Push-Notifications |
| `SMTP_PASSWORD` | E-Mail-Versand |
| `AUTH_MICROSOFT_ENTRA_ID_*` | Microsoft-SSO |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error-Tracking |

---

## 4. Backup-Strategie

Die Datenbank enthaelt **drei Arten kritischer Daten**:

1. **Zeitbuchungen + Audit-Log** → GoBD-relevant, **10 Jahre Aufbewahrung** (§ 147 AO).
2. **Mitarbeiterstammdaten** → DSGVO, bis 3 Jahre nach Ausscheiden + Steuerjahr.
3. **System-Konfiguration** → fuer Wiederherstellung wichtig.

### Taegliche Snapshots (Container `backup`)
Beim Start des `backup`-Containers wird ein `pg_dump` in `./backups/zeitspiel-YYYY-MM-DD_HHMM.dump` abgelegt. Ein interner Cronjob wiederholt das jeden Tag um 03:00.

**Rotations-Regel** (`scripts/backup.sh`):
- Letzte **30 Tage** taeglich
- **Erster-des-Monats** bleibt dauerhaft (GoBD-konform)

### Off-Site-Kopie (Pflicht!)
Ein Dump auf demselben Server ist nur halb geschuetzt — bei Hardware-Verlust weg. Best Practice:

```bash
# Host-cron — z.B. /etc/cron.daily/zeitspiel-offsite
#!/bin/sh
rclone copy /opt/zeitspiel/backups/ hetzner-sb:zeitspiel-backups/ \
  --include "*.dump" \
  --log-file /var/log/zeitspiel-offsite.log
```

Alternativen:
- **Hetzner Storage Box** (`rclone`/`rsync`, DSGVO-konform, Deutschland)
- **Borg/Restic** mit deduplizierter Verschluesselung
- **S3-kompatibel** (MinIO, Wasabi, Backblaze B2)

### Restore

```bash
# In einen Test-Container
docker run --rm -it \
  --network zeitspiel_default \
  -v $(pwd)/backups:/backups \
  postgres:16-alpine \
  pg_restore --host=db --username=zeitspiel --dbname=zeitspiel_restore \
  --clean --if-exists /backups/zeitspiel-YYYY-MM-DD_HHMM.dump
```

**Pruefe Restores einmal pro Quartal.** Ungetestete Backups zaehlen nicht.

### Volume-Snapshots als Ergaenzung
Falls dein Host-Filesystem es unterstuetzt (ZFS, LVM, Btrfs):
```bash
zfs snapshot tank/docker/postgres@$(date +%Y%m%d)
```
Atomar und minutengenau — noch schneller als `pg_dump` zum Restore.

---

## 5. Monitoring

| Ebene | Tool |
|---|---|
| App-Errors | **Sentry** (`@sentry/nextjs`) — Self-Hosted via `sentry` Container moeglich |
| HTTP-Metriken | **Caddy access-log** oder **Grafana + Loki** |
| DB-Metriken | **pg_stat_statements** + **pgmetrics** / Grafana |
| Container-Status | **Portainer Dashboard** |
| Synthetic Checks | **Uptime-Kuma** (selbst hostbar) |

---

## 6. Deployment-Flow

```bash
git pull
docker compose build app
docker compose up -d app
# Entrypoint migriert, startet ~15s
```

**Pre-flight:**
- [ ] `npm test -- --run` gruen
- [ ] Backup manuell getriggert **vor** Deploy
- [ ] Migration-Files in `prisma/migrations/` fuer jede Schema-Aenderung
- [ ] CHANGELOG geupdatet

---

## 7. Go-Live-Checkliste

- [ ] Server mit mind. 2 vCPU / 4 GB RAM / 40 GB Disk
- [ ] `/opt/zeitspiel/.env` mit korrekten Secrets (`chmod 600`)
- [ ] Firewall: nur 80/443 offen, 5432 nicht
- [ ] Portainer installiert und gesichert
- [ ] Stack via Portainer importiert
- [ ] Off-Site-Backup-Target konfiguriert
- [ ] DNS auf Server zeigend, Caddy-Cert ausgestellt
- [ ] `workday.goLiveDate` = Umstellungstag in Einstellungen
- [ ] Salden aus Altsystem via CSV-Import uebernommen
- [ ] SMTP-Test erfolgreich
- [ ] Sentry-DSN eingetragen, Test-Error geworfen
- [ ] Mindestens 1 HR_ADMIN angelegt, 2FA aktiviert
- [ ] Initiales Backup offsite kopiert
- [ ] Support-Kontakt dokumentiert

---

## 8. Incident-Response

| Symptom | Aktion |
|---|---|
| App antwortet nicht | `docker compose logs app` → haeufig OOM oder DB-Down |
| Login-Endpoint 500 | Sentry-Event, `AUTH_SECRET` gesetzt? |
| Auto-Clockout laeuft nicht | Host-Cron oder `cron`-Container triggert `/api/system/auto-clockout` |
| Alle Salden falsch | `workday.goLiveDate` pruefen, CSV-Saldo-Import re-laufen |
| Kompromittierter Admin | `UserRole` loeschen, `revokeAllForUser()`, Passwort-Reset |
| DB langsam | `docker compose exec db psql -U zeitspiel -c 'SELECT * FROM pg_stat_activity;'` |

### Cron fuer Auto-Clockout
Da kein Vercel-Cron existiert, muss ein **externer Trigger** den Endpoint stuendlich aufrufen:

```bash
# Host-cron auf dem Docker-Host
0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/system/auto-clockout > /dev/null
```

Oder: eigener Cron-Container im Stack:
```yaml
cron:
  image: alpine:3
  restart: unless-stopped
  command: |
    sh -c "echo '0 * * * * wget -qO- --header=\"Authorization: Bearer $CRON_SECRET\" http://app:3000/api/system/auto-clockout' | crontab - && crond -f"
```

---

## 9. DSGVO / GoBD

- **Verarbeitungsverzeichnis**: Muster an Datenschutz-Beauftragten.
- **AV-Vertrag**: **entfaellt** bei 100 % Self-Hosting. Falls Sentry/E-Mail extern → dort AVV schliessen.
- **Audit-Log immutable** — keine DELETE-Route.
- **Recht auf Vergessen** vs. **GoBD-Aufbewahrung**: pseudonymisiertes Archivieren bevorzugen.
- **Verschluesselung at Rest**: Postgres-Volume auf LUKS/ZFS.
- **Transport**: HTTPS zwingend via Caddy.
