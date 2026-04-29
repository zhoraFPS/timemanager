# Zeiterfassung MVP — Design Dokument
**Datum:** 2026-04-09  
**Ziel:** Eigenentwicklung einer Atoss Time Control Alternative zur Kosteneinsparung  
**Mitarbeiter:** 500+  
**Erfassungswege:** Web (Browser) + Mobile (PWA)

---

## Kontext

Die aktuelle Atoss-Lizenz verursacht hohe Kosten bei 500+ Mitarbeitern. Ziel ist ein selbst gehostetes System das funktional mit Atoss mithalten kann, langfristig günstiger ist und eigene Anforderungen besser abdeckt. Das System soll on-premise laufen, aber jederzeit auf eine Cloud-Plattform portierbar sein.

---

## Architektur

**Stack:** Next.js (App Router) + PostgreSQL + Prisma + Auth.js + Docker Compose

```
Browser / PWA (Mobile)
        │
Next.js App Router (Frontend + API + Server Actions)
        │
PostgreSQL (via Prisma ORM)

→ Deployment: Docker Compose (on-premise oder Cloud)
```

**Warum dieser Stack:**
- Next.js: Ein Repo, ein Deploy — Frontend + Backend in einem
- PWA: Mobile-Support ohne separates App-Projekt
- PostgreSQL: Kostenlos, robust, auf jeder Infrastruktur verfügbar
- Auth.js: Startet mit Username/Passwort, SSO/LDAP per Config nachrüstbar
- Docker Compose: `docker-compose up` — läuft on-premise wie in der Cloud

---

## Rollen & Berechtigungssystem (RBAC)

Rollen sind keine hardcodierten Werte sondern Datenbankeinträge. Der SuperAdmin kann Rollen frei erstellen und Berechtigungen per Checkbox-Matrix konfigurieren.

### Permission-Modell

| Resource | read | write | approve | export |
|---|---|---|---|---|
| `time_entries` | Zeiten sehen | Nachtragen/Korrigieren | — | CSV/Excel |
| `requests` | Anträge sehen | Antrag stellen | Antrag genehmigen | — |
| `employees` | Stammdaten lesen | Stammdaten bearbeiten | — | — |
| `reports` | Auswertungen sehen | — | — | Exportieren |
| `roles` | Rollen sehen | Rollen erstellen/bearbeiten | — | — |

### Scope-Konzept

- `own` — nur eigene Daten
- `team` — eigenes Team (über managerId)
- `all` — alle Mitarbeiter

### Vordefinierte Startrollen

| Rolle | Permissions |
|---|---|
| `SUPERADMIN` | Alle Permissions, alle Scopes |
| `HR_ADMIN` | employees:*, time_entries:all, requests:all+approve, reports:all+export |
| `MANAGER` | time_entries:read:team, requests:read+approve:team, reports:read:team |
| `EMPLOYEE` | time_entries:read:own, requests:read+write:own |

Alle Startrollen sind editierbar. Neue Rollen können frei angelegt werden.

---

## Datenbankmodell

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  employeeId  String?  @unique   // externe Personalnummer
  managerId   String?
  department  String?
  manager     User?    @relation("UserManager", fields: [managerId], references: [id])
  reports     User[]   @relation("UserManager")
  roles       UserRole[]
  timeEntries TimeEntry[]
  requests    Request[]
  createdAt   DateTime @default(now())
}

model Role {
  id          String           @id @default(cuid())
  name        String           @unique
  description String?
  permissions RolePermission[]
  users       UserRole[]
}

model RolePermission {
  id       String @id @default(cuid())
  roleId   String
  resource String  // time_entries | requests | employees | reports | roles
  action   String  // read | write | approve | export
  scope    String  // own | team | all
  role     Role   @relation(fields: [roleId], references: [id])
}

model UserRole {
  userId String
  roleId String
  user   User   @relation(fields: [userId], references: [id])
  role   Role   @relation(fields: [roleId], references: [id])
  @@id([userId, roleId])
}

model TimeEntry {
  id           String    @id @default(cuid())
  userId       String
  clockIn      DateTime
  clockOut     DateTime?
  type         String    // WORK | BREAK
  note         String?
  correctedBy  String?   // userId des HR-Admins der korrigiert hat
  correctedAt  DateTime?
  user         User      @relation(fields: [userId], references: [id])
  createdAt    DateTime  @default(now())
}

model Request {
  id        String            @id @default(cuid())
  userId    String
  type      String            // VACATION | SICK | HOMEOFFICE | TIME_CORRECTION | OVERTIME_REDUCE | SPECIAL_LEAVE
  dateFrom  DateTime
  dateTo    DateTime
  status    String            // PENDING | APPROVED | REJECTED | CANCELLED
  payload   Json?             // typ-spezifische Felder (Grund, Zielzeit, etc.)
  user      User              @relation(fields: [userId], references: [id])
  approvals RequestApproval[]
  createdAt DateTime          @default(now())
}

model RequestApproval {
  id         String   @id @default(cuid())
  requestId  String
  approverId String
  status     String   // APPROVED | REJECTED
  comment    String?
  decidedAt  DateTime @default(now())
  request    Request  @relation(fields: [requestId], references: [id])
}

model WorkingTimeAccount {
  id            String   @id @default(cuid())
  userId        String
  date          DateTime
  targetHours   Float    // Soll (lt. Arbeitszeitmodell)
  actualHours   Float    // Ist (aus TimeEntries)
  balance       Float    // Ist - Soll (Gleitzeit-Saldo)
  vacationDays  Float    // Resturlaub
  overtimeHours Float    // kumulierte Überstunden
  @@unique([userId, date])
}

model WorkingTimeModel {
  id             String  @id @default(cuid())
  name           String
  hoursPerDay    Float   // z.B. 8.0
  hoursPerWeek   Float   // z.B. 40.0
  breakMinutes   Int     // Pflichtpause in Minuten
  vacationDaysPerYear Int
}
```

---

## Module & Screens

### Mitarbeiter (ESS)

**Dashboard**
- Stempeluhr (großer Ein/Ausstempeln Button)
- Heutiger Status (gestempelt seit X, Pause, Feierabend)
- Zeitkonto-Widget (Gleitzeit-Saldo, Resturlaub, Überstunden)
- Offene Anträge (Status-Übersicht)

**Zeitübersicht**
- Monatsansicht (Kalender mit Ein/Auszeiten)
- Wochendetail (Stunden pro Tag, Soll/Ist Vergleich)
- Jahresübersicht (Urlaub, Fehltage, Überstunden)

**Antrag stellen**
- Urlaub (Datepicker, Live-Resturlaub-Check)
- Krankmeldung (Zeitraum, optional Attest-Upload)
- Homeoffice (Tag oder Zeitraum)
- Zeitkorrektur (Tag, Soll-Zeit, Grund)
- Überstundenabbau (Zeitraum)
- Sonderurlaub (Typ + Freitextgrund)

### Manager

**Team-Dashboard**
- Wer ist heute anwesend / HO / krank / Urlaub
- Offene Anträge (Badge mit Anzahl)
- Team-Kalender (Urlaub-Überschneidungen visualisieren)

**Antragsbearbeitung**
- Antragsdetail mit vollständiger History
- Genehmigen / Ablehnen + optionaler Kommentar
- Eskalation an HR

### HR Admin

**Mitarbeiterverwaltung**
- Mitarbeiter anlegen / bearbeiten / deaktivieren
- Rolle + Manager zuweisen
- Arbeitszeitmodell zuweisen

**Zeitkorrekturen**
- Beliebige Zeitbuchung nachtragen
- Fehlbuchungen korrigieren
- Audit-Log (wer hat wann was geändert — unveränderlich)

**Auswertungen & Export**
- Monatsreport pro Mitarbeiter
- Überstunden-Übersicht (alle Mitarbeiter)
- Urlaubsliste (Jahresplanung)
- Export CSV / Excel (DATEV-ready vorbereitet)

### SuperAdmin

**Rollenverwaltung**
- Rollen anlegen / bearbeiten / löschen
- Permissions per Checkbox-Matrix konfigurieren
- Rollen Mitarbeitern zuweisen

**Systemkonfiguration**
- Arbeitszeitmodelle verwalten (Stunden/Tag, Feiertage, Pausenregeln)
- Abteilungen / Teams verwalten
- Feiertage konfigurieren (pro Bundesland)

**Integrationen (vorbereitet, im MVP inaktiv)**
- DATEV Export (Schnittstelle vorbereitet)
- SSO / LDAP (Auth.js Provider vorbereitet)
- Webhook-System für Drittanbieter

---

## MVP-Abgrenzung

**Im MVP enthalten:**
- Alle 4 Rollen-Ebenen (SUPERADMIN, HR_ADMIN, MANAGER, EMPLOYEE)
- Stempeln (Web + PWA)
- Vollständiges Antragswesen mit Genehmigungsworkflow
- Arbeitszeitkonto (Gleitzeit-Saldo, Resturlaub, Überstunden)
- HR-Korrekturen mit Audit-Log
- Basiscreports + CSV-Export
- RBAC konfigurierbar per UI

**Nicht im MVP (Phase 2):**
- Hardware-Terminal-Support
- DATEV-Direktintegration
- SSO / Active Directory
- Mobile Native App (iOS/Android)
- KI-gestützte Schichtplanung
- Lohnabrechnung

---

## Deployment

```yaml
# docker-compose.yml (Grundstruktur)
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://...
      NEXTAUTH_SECRET: ...
    depends_on: [db]

  db:
    image: postgres:16
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: zeiterfassung
      POSTGRES_PASSWORD: ...

volumes:
  postgres_data:
```

On-premise: `docker-compose up -d`  
Cloud: Selbes Image auf AWS ECS, Azure Container Apps, Google Cloud Run, Vercel (mit externer DB)
