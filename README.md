# Zeitspiel — Digitale Zeiterfassung

Webbasierte Zeiterfassungslösung mit mobiler App. Besteht aus drei Komponenten:

| Komponente | Technologie | Port |
|-----------|-------------|------|
| Web-Oberfläche | Next.js | 3000 |
| API-Server | Next.js (API-only) | 3001 |
| Datenbank | PostgreSQL 16 | intern |

---

## Voraussetzungen

- **Docker** >= 24 und **Docker Compose** >= 2.20
- Eine Domain mit DNS-Eintrag auf den Server (nur für HTTPS mit Caddy nötig)
- Optional: SMTP-Zugang für E-Mail-Benachrichtigungen
- Optional: Microsoft Entra ID (Azure AD) für SSO-Login

Docker installieren (Ubuntu/Debian):
```bash
curl -fsSL https://get.docker.com | sh
```

---

## Einrichtung

### 1. Repository klonen

```bash
git clone https://dein-gitea.intern/user/zeitspiel.git
cd zeitspiel
```

### 2. Umgebungsvariablen anlegen

```bash
cp .env.example .env
```

Dann `.env` mit einem Texteditor öffnen und befüllen:

```bash
nano .env
```

#### Pflichtfelder

| Variable | Beschreibung | Beispiel |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Datenbankpasswort — sicher wählen | `MeinSicheresPasswort123!` |
| `AUTH_SECRET` | Session-Schlüssel (mind. 32 Zeichen) | siehe unten |
| `NEXTAUTH_SECRET` | Identisch mit `AUTH_SECRET` | siehe unten |
| `NEXTAUTH_URL` | Öffentliche URL der Web-Oberfläche | `https://zeitspiel.firma.de` |
| `CRON_SECRET` | Schlüssel für automatischen Ausstempel-Job | siehe unten |

Sichere Zufallsschlüssel generieren:
```bash
# AUTH_SECRET und NEXTAUTH_SECRET (gleichen Wert für beide verwenden)
openssl rand -base64 32

# CRON_SECRET
openssl rand -base64 32
```

#### Optionale Felder

**Web-Push-Benachrichtigungen** (für Handy-Benachrichtigungen):
```bash
# VAPID-Keys einmalig generieren:
docker run --rm node:24-alpine npx web-push generate-vapid-keys
```
Ergebnis in `VAPID_PUBLIC_KEY` und `VAPID_PRIVATE_KEY` eintragen.
`VAPID_SUBJECT` auf eine gültige E-Mail-Adresse setzen (z. B. `mailto:admin@firma.de`).

**E-Mail-Versand (SMTP)**:
`SMTP_PASSWORD` mit dem Passwort des SMTP-Kontos befüllen.
Server-Adresse und Absender werden nach dem ersten Start in den Admin-Einstellungen der App konfiguriert.

**Microsoft-Login (Azure AD / Entra ID)**:
Alle drei `AUTH_MICROSOFT_ENTRA_ID_*`-Variablen müssen gesetzt sein — dann erscheint auf der Login-Seite die Schaltfläche „Mit Microsoft anmelden".
Redirect-URI im Azure-Portal eintragen: `https://deine-domain.de/api/auth/callback/microsoft-entra-id`

---

### 3. Domain eintragen (für HTTPS)

In der `.env`:
```
DOMAIN="zeitspiel.firma.de"
```

Die `Caddyfile` liest `$DOMAIN` automatisch aus der `.env` — kein weiterer Eingriff nötig.

---

### 4. Starten

#### Ohne HTTPS (lokales Netzwerk / Test)

```bash
docker compose up -d
```

Web-Oberfläche erreichbar unter: `http://server-ip:3000`

#### Mit HTTPS und automatischem Zertifikat (Caddy)

Voraussetzung: Domain zeigt auf den Server, Ports 80 und 443 sind offen.

```bash
docker compose --profile proxy up -d
```

Web-Oberfläche erreichbar unter: `https://zeitspiel.firma.de`

#### Mit automatischem Datenbank-Backup

```bash
docker compose --profile proxy --profile backup up -d
```

Backups werden täglich um 03:00 Uhr nach `./backups/` geschrieben (30 Tage aufbewahrt).

---

### 5. Erster Login

Nach dem ersten Start wird die Datenbank automatisch mit Grunddaten befüllt.

| Feld | Wert |
|------|------|
| Mitarbeiternummer | `1000` |
| Passwort | `admin123` |

> **Passwort nach dem ersten Login sofort ändern.**

Der Admin-Account hat vollen Zugriff auf alle Funktionen. Neue Mitarbeiter werden unter **Dashboard → Mitarbeiter → Neu** angelegt.

---

## Container-Übersicht

```
┌─────────────────────────────────────────────────────┐
│ Browser                          Mobile App         │
└───────────────┬──────────────────────┬──────────────┘
                │ Port 80/443          │ Port 3001
         ┌──────▼──────┐       ┌───────▼───────┐
         │  Caddy       │       │  API-Server   │
         │  (optional)  │       │  Port 3001    │
         └──────┬───────┘       │  Prisma + DB  │
                │ Port 3000     └───────┬───────┘
         ┌──────▼───────┐              │
         │  Web-Frontend │◄─────────────┘
         │  Port 3000    │  /api/* intern weitergeleitet
         └───────────────┘
                    ┌───────────────┐
                    │  PostgreSQL   │
                    │  (nur intern) │
                    └───────────────┘
```

Die mobile App verbindet sich direkt mit dem API-Server (Port 3001).

---

## Mobile App einrichten

Die mobile App (Expo / React Native) liegt unter `apps/mobile/`.

**Voraussetzungen:**
- Node.js >= 20
- Expo Go App auf dem Smartphone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

**Starten:**
```bash
cd apps/mobile
npm install
EXPO_PUBLIC_API_URL=http://server-ip:3001 npm start
```

QR-Code mit der Expo Go App scannen.

Für eine feste Konfiguration eine `apps/mobile/.env` anlegen:
```
EXPO_PUBLIC_API_URL=http://server-ip:3001
```

---

## Laufender Betrieb

### Status prüfen

```bash
docker compose ps
```

### Logs ansehen

```bash
# Alle Container
docker compose logs -f

# Nur API-Server
docker compose logs -f api

# Nur Web-Frontend
docker compose logs -f web
```

### Update einspielen

```bash
git pull
docker compose build
docker compose up -d
```

Datenbankmigrationen werden beim Start des API-Containers automatisch ausgeführt.

### Manuelles Backup

```bash
docker compose run --rm backup /usr/local/bin/backup.sh
```

Backups liegen unter `./backups/` auf dem Host.

### Backup einspielen

```bash
# Backup entpacken
gunzip backups/zeitspiel_DATUM.sql.gz

# In die Datenbank einspielen
docker compose exec db psql -U zeitspiel -d zeitspiel < backups/zeitspiel_DATUM.sql
```

---

## Lokale Entwicklung

### Nur die Datenbank starten

```bash
docker compose up -d db
```

### API-Server lokal starten

```bash
cd apps/api
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
# läuft auf http://localhost:3001
```

### Web-Frontend lokal starten

```bash
# im Root-Verzeichnis
npm install
API_URL=http://localhost:3001 npm run dev
# läuft auf http://localhost:3000
```

### Mobile App lokal starten

```bash
cd apps/mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:3001 npm start
```

---

## Verzeichnisstruktur

```
zeitspiel/
├── apps/
│   ├── api/               # API-Server (Next.js, Prisma, Auth)
│   │   ├── prisma/        # Datenbankschema und Migrationen
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── app/api/   # Alle API-Endpunkte
│   │       └── lib/       # Datenbankzugriff, Business-Logik
│   └── mobile/            # Mobile App (Expo / React Native)
├── src/                   # Web-Frontend (Next.js)
│   ├── app/               # Seiten (Dashboard, Login usw.)
│   └── components/        # UI-Komponenten
├── scripts/               # Backup-Skript
├── .env.example           # Vorlage für Umgebungsvariablen
├── Caddyfile              # HTTPS-Konfiguration
├── docker-compose.yml
└── Dockerfile             # Web-Frontend Container
```

---

## Häufige Probleme

**Container startet nicht — `POSTGRES_PASSWORD` fehlt**
```
Error: set POSTGRES_PASSWORD in .env
```
→ `.env` anlegen und `POSTGRES_PASSWORD` setzen (Schritt 2).

**Login funktioniert nicht nach Update**
→ Datenbankmigrationen prüfen:
```bash
docker compose logs api | grep migrate
```

**Mobile App verbindet sich nicht**
→ `EXPO_PUBLIC_API_URL` muss auf die IP/Domain des Servers zeigen, nicht `localhost`.
Firewall prüfen: Port 3001 muss erreichbar sein.

**HTTPS-Zertifikat wird nicht ausgestellt**
→ Ports 80 und 443 müssen offen sein und die Domain muss auf den Server zeigen.
Caddy-Logs prüfen:
```bash
docker compose logs proxy
```
