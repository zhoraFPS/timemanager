# Phase 3 — Mitarbeiterverwaltung Design

**Datum:** 2026-04-09

---

## Datenmodell-Erweiterungen

### User (Erweiterungen)
```prisma
employeeNumber     String?  @unique   // Mitarbeiternummer z.B. "1042"
startDate          DateTime?          // Eintrittsdatum
mustChangePassword Boolean  @default(true)
contractType       String   @default("FULLTIME")
initialBalance     Float    @default(0) // Anfangssaldo Stunden
```

### WorkingTimeConfig (neu, 1:1 zu User)
```prisma
model WorkingTimeConfig {
  id            String   @id @default(cuid())
  userId        String   @unique
  hoursPerDay   Float    @default(8.0)
  hoursPerWeek  Float    @default(40.0)
  vacationDays  Int      @default(28)
  breakMinutes  Int      @default(30)
  effectiveFrom DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id])
}
```

### Department (neu)
```prisma
model Department {
  id    String @id @default(cuid())
  name  String @unique
  users User[]
}
```

### User.department → User.departmentId (FK zu Department)

---

## Vertragsart-Vorlagen

| Typ | h/Tag | h/Woche | Urlaub |
|---|---|---|---|
| FULLTIME | 8.0 | 40.0 | 28 |
| PARTTIME | 4.0 | 20.0 | 14 |
| MINIJOB | 2.0 | 10.0 | 10 |
| INTERN | 8.0 | 40.0 | 10 |
| FREELANCE | 8.0 | 40.0 | 0 |

---

## Login-System

- Login per **Mitarbeiternummer** (nicht E-Mail)
- Mitarbeiternummer = auto-generiert (nächste freie ab 1000), überschreibbar
- Erstlogin → Zwangsweiterleitung `/dashboard/passwort-aendern`
- `mustChangePassword = true` → middleware blockiert alle anderen Routen außer /passwort-aendern

---

## Anlege-Wizard (3 Schritte)

### Schritt 1: Stammdaten
- Vorname + Nachname
- Mitarbeiternummer (Vorschlag auto, überschreibbar)
- E-Mail (optional)
- Abteilung (Dropdown aus Department-Tabelle)
- Vorgesetzter (Dropdown)
- Eintrittsdatum

### Schritt 2: Arbeitszeit & Urlaub
- Vertragsart → füllt Felder vor
- Stunden/Woche (überschreibbar)
- Stunden/Tag (überschreibbar)
- Urlaubstage/Jahr (überschreibbar)
- Pausenminuten
- Anfangssaldo (± Stunden)

### Schritt 3: Zugang
- Standardpasswort (anzeigen/kopieren)
- Passwortänderung erzwingen (Standard: ✓)
- Rolle (nur SysAdmin)

---

## Mitarbeiter-Suche

- Echtzeit-Suche (debounced 300ms)
- Felder: Name, Nummer, Abteilung
- Filter: Vertragsart, Status
- Tabelle mit: Nr. / Name / Abteilung / Vertrag / Status

---

## CSV-Import

Format:
```csv
employeeNumber,firstName,lastName,email,department,contractType,hoursPerWeek,vacationDays,startDate
1001,Max,Mustermann,max@firma.de,Büro,FULLTIME,40,28,2024-01-01
```

- Validierung vor Import (Vorschau mit Fehlern)
- Duplikat-Erkennung (employeeNumber already exists)
- Batch-Create mit Standardpasswort

---

## Passwort-Selbstverwaltung

- `/dashboard/profil` — eigenes Passwort ändern
- Aktuelles Passwort bestätigen → Neues Passwort setzen

---

## Abteilungsverwaltung

- In Einstellungen: Abteilungen anlegen/umbenennen/löschen
- Löschen nur wenn keine aktiven Mitarbeiter

---

## Implementierungsreihenfolge

1. DB-Migration (WorkingTimeConfig, Department, User-Erweiterungen)
2. Login per Mitarbeiternummer + mustChangePassword Flow
3. Abteilungsverwaltung API + UI
4. Mitarbeiter-Anlege-Wizard (3 Schritte)
5. Mitarbeiter-Suche + Tabelle + Bearbeitung
6. CSV-Import
7. Passwort-Selbstverwaltung (/dashboard/profil)
