# Zeiterfassung Phase 2 — Design Dokument

**Datum:** 2026-04-09
**Kontext:** Fußballverein, 500+ Mitarbeiter, Atoss-Alternative

---

## 1. Dashboard Cockpit

### Layout (4-Spalten Grid)

```
┌──────────────────────────────┬──────────────────────────────┐
│  Stempeluhr (2 Spalten)      │  Zeitkonto (2 Spalten)       │
│  Button-Grid + Timer         │  Saldo / Urlaub / Überstunden│
├──────────────────────────────┼──────────────────────────────┤
│  Team Heute (2 Spalten)      │  Schnellaktionen (1 Spalte)  │
│  Avatar-Liste: Status        │  + Letzte Notifications      │
├──────────────────────────────┼──────────────────────────────┤
│  Offene Anträge (2 Spalten)  │  Wochenmini (2 Spalten)      │
└──────────────────────────────┴──────────────────────────────┘
```

### Widgets

**Stempeluhr** — siehe Abschnitt 3 (Stempeltypen)

**Zeitkonto-Widget**
- Gleitzeit-Saldo (± Stunden, grün/rot)
- Resturlaub (X von Y Tagen, Progress-Bar)
- Überstunden kumuliert
- Daten aus `WorkingTimeAccount` Tabelle

**Team-Status-Widget** (Manager/HR sehen Team, Employee sieht eigene Woche)
- Avatar + Name + Status-Badge (Anwesend / HO / Krank / Urlaub / Auswärtsspiel / etc.)
- Quelle: aktuell aktive TimeEntries + genehmigte Requests für heute

**Schnellaktionen**
- Urlaub beantragen (→ /dashboard/antraege)
- Krankmeldung (→ direktes Modal)
- Zeitkorrektur (→ direktes Modal)

**Offene Anträge** — kompakte Liste mit Status-Badges

**Wochenmini** — 7 Tage Balken (Mo–So), Stunden pro Tag visuell

---

## 2. Zeitansicht — 3 Modi

### Toggle
```
[Monat ▦] [Woche ▤] [Tabelle ☰]     ← April 2026 →
```

### Modus 1: Monatskalender
- 7-Spalten Grid (Mo–So)
- Pro Tag: Stundenanzahl + Farbcode
  - Grün: Soll erfüllt
  - Gelb: < 80% Soll
  - Rot: 0 Stunden (Fehltag)
  - Blau: Urlaub
  - Grau: Wochenende / Feiertag
- Klick auf Tag → Detail-Popover mit allen Einträgen des Tages

### Modus 2: Wochenansicht (Balken)
- 7 Spalten (Mo–So), Y-Achse = Uhrzeit (07:00–20:00)
- Zeitblöcke als farbige Balken (Farbe je nach Stempeltyp)
- Hover → Tooltip: Einstempeltyp, Von, Bis, Dauer
- Navigation: Vorherige/Nächste Woche

**Farbzuordnung Stempeltypen:**
- Kommen → Blau
- Mobiles Arbeiten → Lila
- Heimspiel → Grün
- Auswärtsspiel → Orange
- Dienstreise → Gelb
- Fortbildung → Cyan
- Corporate Volunteering → Pink

### Modus 3: Monatstabelle (Atoss-Style)

```
┌────────────┬──────────┬──────────┬──────┬─────────┬────────┬──────────┐
│ Tag        │ Typ      │ Einstpl. │Ausstpl│ Ist-Std │ Saldo  │ Aktion   │
├────────────┼──────────┼──────────┼──────┼─────────┼────────┼──────────┤
│ Mo 07.04.  │ Kommen   │ 08:02    │17:15 │  8:43   │ +0:43  │ ✏️       │
│ Di 08.04.  │ Heimspiel│ 09:15    │18:00 │  8:15   │ +0:15  │ ✏️       │
│ Mi 09.04.  │ —        │  —       │  —   │  0:00   │ -8:00  │ ✏️       │
│ Do 10.04.  │ [Urlaub] │  —       │  —   │  8:00   │  0:00  │          │
├────────────┼──────────┼──────────┼──────┼─────────┼────────┼──────────┤
│ Monat      │          │          │      │ 82:30   │ +2:30  │          │
└────────────┴──────────┴──────────┴──────┴─────────┴────────┴──────────┘
```

- Saldo: grün (positiv) / rot (negativ)
- Urlaub/Krank als farbiger Badge statt Zeiten
- ✏️ Button → Zeitkorrektur-Modal (mit Audit Log, max. X Tage konfigurierbar)
- Mehrere Einträge pro Tag (z.B. Kommen + Heimspiel) → aufklappbare Zeile

---

## 3. Stempeluhr — Fußballverein Stempeltypen

### Einstempel-Typen
| Typ | Label | Farbe |
|---|---|---|
| `WORK` | Kommen | Blau |
| `MOBILE_WORK` | Mobiles Arbeiten | Lila |
| `HOME_GAME` | Heimspiel | Grün |
| `AWAY_GAME` | Auswärtsspiel | Orange |
| `BUSINESS_TRIP` | Dienstreise | Gelb |
| `TRAINING` | Fortbildung | Cyan |
| `VOLUNTEERING` | Corporate Volunteering | Pink |

### Ausstempel-Typ
| Typ | Label |
|---|---|
| `LEAVE` | Gehen |

### UI
```
┌─────────────────────────────────────────────────────────┐
│  ● HEIMSPIEL  seit 14:30 — 02:15:43                    │
├─────────────────────────────────────────────────────────┤
│  [Kommen]     [Mob. Arbeiten]  [Heimspiel ✓]           │
│  [Auswärtsspl] [Dienstreise]  [Fortbildung]            │
│  [Corp. Volunteering]                                   │
│                                                         │
│              ████  GEHEN  ████                          │
└─────────────────────────────────────────────────────────┘
```

### Logik beim Typ-Wechsel (Option C)
1. Aktiven Eintrag schließen (`clockOut = now`)
2. Neuen Eintrag mit neuem Typ öffnen (`clockIn = now`)
3. Beide Einträge im Tageslog als verbundene Session sichtbar

### Zeitkorrektur durch Mitarbeiter
- ✏️ Button in Monatstabelle öffnet Modal
- Felder: Neuer Typ, Neue Einzeit, Neue Auszeit, Pflichtbegründung
- Prüfung: `now - clockIn.date <= SystemConfig.maxCorrectionDays`
- Erstellt `TimeEntryEditRequest` (Status: PENDING)
- → Notification an Manager
- Manager genehmigt/lehnt ab → `AuditLog` Eintrag

### SystemConfig (SuperAdmin konfigurierbar)
```
maxCorrectionDays: 7    ← Standard
```

---

## 4. Notification-System

### Datenbankmodell

```prisma
model Notification {
  id         String   @id @default(cuid())
  userId     String                        // Empfänger
  senderId   String?                       // null = System
  type       String                        // SYSTEM | MESSAGE | APPROVAL | CORRECTION
  title      String
  body       String
  link       String?                       // Deep-Link in der App
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
  user       User     @relation("UserNotifications", fields: [userId], references: [id])
  sender     User?    @relation("SenderNotifications", fields: [senderId], references: [id])
}

model NotificationPreference {
  userId           String  @id
  emailEnabled     Boolean @default(true)
  browserPushEnabled Boolean @default(false)
  pushSubscription Json?                   // Web Push Subscription Object
  user             User    @relation(fields: [userId], references: [id])
}

model SystemConfig {
  key   String @id
  value String
  // Beispiel: key="maxCorrectionDays", value="7"
}

model TimeEntryEditRequest {
  id           String   @id @default(cuid())
  timeEntryId  String
  userId       String
  newType      String?
  newClockIn   DateTime?
  newClockOut  DateTime?
  reason       String
  status       String   @default("PENDING") // PENDING | APPROVED | REJECTED
  reviewedBy   String?
  reviewedAt   DateTime?
  createdAt    DateTime @default(now())
}
```

### Automatische System-Notifications (Trigger)

| Event | Empfänger | Titel |
|---|---|---|
| Antrag eingereicht | Manager | "Neuer Antrag von [Name]" |
| Antrag genehmigt | Mitarbeiter | "Ihr Urlaubsantrag wurde genehmigt" |
| Antrag abgelehnt | Mitarbeiter | "Ihr Urlaubsantrag wurde abgelehnt" |
| Zeitkorrektur eingereicht | Manager | "Zeitkorrektur-Antrag von [Name]" |
| Zeitkorrektur genehmigt | Mitarbeiter | "Ihre Zeitkorrektur wurde genehmigt" |
| Neue Nachricht | Empfänger | "[Name]: [Vorschau]" |

### Zustellung

**1. In-App (immer)**
- Badge-Counter in Sidebar: `🔔 [3]`
- Polling alle 30 Sekunden: `GET /api/notifications/unread-count`
- Inbox-Seite: `/dashboard/nachrichten`

**2. Browser-Push (optional, per User-Einstellung)**
- Service Worker + Web Push API
- `POST /api/notifications/subscribe` speichert PushSubscription in DB
- Server sendet Push via `web-push` npm package

**3. E-Mail (optional, per User-Einstellung)**
- `nodemailer` mit SMTP-Config in SystemConfig
- Nur bei: Antrag genehmigt/abgelehnt, Zeitkorrektur-Entscheidung, neue Nachricht

### Inbox UI
```
Nachrichten
├── [Filter: Alle | Ungelesen | System | Nachrichten]
│
├── 🔵 HR Admin — "Urlaubsplanung Sommer 2026"
│      vor 2 Stunden · Antworten
│
├── ✅ System — "Ihr Urlaubsantrag (14.–18.07.) wurde genehmigt"
│      gestern · → Zum Antrag
│
└── [Neue Nachricht]
     Empfänger: [Person suchen / Abteilung / Alle]
     Betreff: ___________
     Nachricht: ___________
```

### Manager/HR Teamansicht

Neue Seite: `/dashboard/team/[userId]`

```
Tabs: [Zeitkonto] [Monatsübersicht] [Urlaubsplan] [Nachrichten]

Zeitkonto:    Saldo, Resturlaub, Überstunden
Monatsübersicht: Identisch mit Modus 3 (Tabelle) — aber für fremden User
Urlaubsplan:  Jahreskalender mit allen genehmigten/offenen Urlauben
Nachrichten:  Direktnachricht an diesen Mitarbeiter senden
```

---

## 5. Neue Prisma-Modelle (Erweiterung)

Zusätzlich zu den bestehenden Modellen:

- `Notification` — In-App + Push + E-Mail Zustellung
- `NotificationPreference` — Pro-User Einstellungen
- `SystemConfig` — Key-Value Store für Admin-Konfiguration
- `TimeEntryEditRequest` — Mitarbeiter-Zeitkorrekturen mit Audit

### TimeEntry Erweiterung
```prisma
type String @default("WORK")
// Neue Werte: MOBILE_WORK | HOME_GAME | AWAY_GAME |
//             BUSINESS_TRIP | TRAINING | VOLUNTEERING | LEAVE
```

---

## 6. Implementierungsreihenfolge

1. DB-Migration (neue Modelle + TimeEntry type erweitern)
2. Stempeluhr neu (Button-Grid, Typ-Wechsel-Logik)
3. Zeitansicht neu (3 Modi)
4. Zeitkorrektur durch Mitarbeiter (Modal + EditRequest)
5. Dashboard Cockpit (alle Widgets)
6. Notification-System (In-App zuerst, dann Push, dann Mail)
7. Manager/HR Teamansicht
