# Mobile App MVP — Design Dokument

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Native Mobile App (Android + iOS) als Companion zur bestehenden Web-App fuer Zeiterfassung, Antraege und Team-Uebersicht.

**Architecture:** Expo SDK 53 mit Expo Router (file-based navigation), Nativewind fuer Styling, Zustand fuer State Management. Kommuniziert mit dem bestehenden Next.js-Backend ueber REST API. Offline-faehiges Stempeln mit lokaler Queue.

**Tech Stack:** Expo SDK 53, Expo Router, Nativewind, Zustand, expo-secure-store, expo-local-authentication, expo-notifications, Axios, Lottie, Sentry

---

## 1. MVP Scope

### Enthalten (IN)

- Stempeln (Ein/Aus) mit Projekt-Auswahl
- Live-Timer bei laufender Buchung
- Zeitansicht (Wochenansicht mit Ist/Soll-Vergleich)
- Gleitzeit-Saldo
- Antraege erstellen und verwalten (Urlaub, Krank, Homeoffice, Korrektur)
- Team-Status (wer ist eingestempelt)
- Schichtplan-Ansicht (aktuelle Woche)
- Biometrischer Login (Face ID / Fingerprint)
- QR-Code-Kopplung fuer Geraete-Registrierung
- Push Notifications (Antrag-Status, Schichtaenderung, Ausstempel-Erinnerung)
- Offline-Stempeln mit automatischem Sync

### Nicht enthalten (OUT)

- Admin-Einstellungen (zu kritisch fuer Mobile)
- DATEV-Export
- Rollen- und Rechteverwaltung
- Audit-Log
- Monatsabschluss
- PDF-Exporte
- Mitarbeiter-Verwaltung
- Surcharge/Zuschlagsberechnung
- Projekt-Verwaltung (nur Auswahl beim Stempeln)
- Schichtplan-Bearbeitung (nur Ansicht)

---

## 2. Projekt-Struktur

```
apps/mobile/
  app/
    _layout.tsx              — Root Layout (AuthProvider, ThemeProvider)
    login.tsx                — Login Screen
    qr-scan.tsx              — QR-Code Scanner
    biometric.tsx            — Biometrischer Login
    (tabs)/
      _layout.tsx            — Tab Navigator (5 Tabs)
      index.tsx              — Tab 1: Stempeln
      zeiten.tsx             — Tab 2: Zeitansicht
      antraege/
        index.tsx            — Tab 3: Antraege-Liste
        neu.tsx              — Neuer Antrag
      team.tsx               — Tab 4: Team-Status + Schichtplan
      profil.tsx             — Tab 5: Profil
  lib/
    api.ts                   — Axios API Client mit Interceptor
    auth.ts                  — Auth-Logik (Login, Refresh, Biometrie)
    store.ts                 — Zustand Stores (auth, time, team)
    types.ts                 — TypeScript Types (shared mit Web)
    offline-queue.ts         — Offline-Stempel-Queue
    notifications.ts         — Push-Token-Registrierung + Handler
  components/
    stamp-button.tsx         — Animierter Stempel-Button (Lottie)
    project-chips.tsx        — Horizontal scrollbare Projekt-Auswahl
    time-entry-card.tsx      — Zeiteintrag-Karte (Tag + Balken)
    week-summary.tsx         — Wochen-Zusammenfassung
    request-card.tsx         — Antrags-Karte mit Status-Badge
    request-form.tsx         — Antrags-Formular
    team-member-card.tsx     — Team-Mitglied mit Online-Status
    shift-grid.tsx           — Kompaktes Schichtplan-Grid
    gleitzeit-card.tsx       — Gleitzeit-Saldo-Karte
    offline-badge.tsx        — Ausstehende-Stempel-Counter
  assets/
    lottie/                  — Animationen (Pulse, Success, etc.)
    images/                  — App-Icons, Splash Screen
  app.json                   — Expo Config
  eas.json                   — EAS Build Profile
  tailwind.config.js         — Nativewind Config
```

---

## 3. Navigation

### 5 Bottom Tabs

| Tab | Icon | Label | Screen |
|-----|------|-------|--------|
| 1 | Timer | Stempeln | Stempel-Button + Live-Timer + Projekt-Picker |
| 2 | Calendar | Zeiten | Wochenansicht + Summary |
| 3 | FileText | Antraege | Liste + Erstellen (Stack) |
| 4 | Users | Team | Status-Karten + Schichtplan |
| 5 | User | Profil | Konto + Einstellungen |

### Auth Flow (vor Tabs)

```
App Start
  → Token vorhanden?
    → Ja: Biometrie aktiviert?
      → Ja: Biometrie-Screen → Erfolg → Tabs
      → Nein: Direkt → Tabs
    → Nein: Login-Screen
      → E-Mail/Passwort ODER QR-Scan → Tabs
```

---

## 4. Authentifizierung

### Stufe 1: Erstanmeldung (E-Mail/Passwort)

User gibt bestehende Web-Credentials ein. App ruft `/api/auth/callback/credentials` auf, erhaelt JWT-Token. Token wird in `expo-secure-store` gespeichert. Gleichzeitig wird eine `deviceId` (UUID) generiert und am Server registriert via `/api/auth/devices`.

### Stufe 2: QR-Code-Kopplung

Fuer Mitarbeiter ohne Passwort-Zugang (z.B. Aushilfen). Ein Admin generiert im Web-Dashboard einen temporaeren QR-Code (`/api/auth/device-token`). Mitarbeiter scannt in der App — Token wird gegen vollwertiges JWT getauscht + Device registriert. QR-Code: 5 Minuten gueltig, einmalig nutzbar.

### Stufe 3: Biometrie

Nach erfolgreicher Erstanmeldung: "Biometrische Anmeldung aktivieren?" Bei Ja wird das Refresh-Token mit `expo-local-authentication` geschuetzt. Naechster App-Start: Face ID / Fingerprint genuegt. Fallback auf Passwort nach 3 fehlgeschlagenen Versuchen.

### Token-Management

| Token | Lebensdauer | Speicherort |
|-------|-------------|-------------|
| Access-Token | 15 Minuten | Memory (Zustand Store) |
| Refresh-Token | 30 Tage | expo-secure-store |

- Silent Refresh via Axios-Interceptor bei 401
- Bei erneutem 401 nach Refresh: Logout + Login-Screen
- Logout loescht beide Tokens + Device-Registrierung am Server

---

## 5. Screens im Detail

### Tab 1: Stempeln

- **Zentraler Button:** Grosser runder Button (80x80), animiert mit Lottie-Pulse wenn aktiv. Gruen = Einstempeln, Rot = Ausstempeln. Haptic Feedback beim Tap (`expo-haptics`).
- **Live-Timer:** Laufzeit der aktuellen Buchung als HH:MM:SS Counter oberhalb des Buttons.
- **Projekt-Picker:** Horizontal scrollbare Chip-Liste mit Farbpunkt + Projekt-Code. "Kein Projekt" als Default-Option.
- **Gleitzeit-Karte:** Kompakte Karte unterhalb mit aktuellem Saldo (+ oder - Stunden).
- **Offline-Badge:** Bei ausstehenden Stempeln: Badge-Counter oben rechts.

### Tab 2: Zeiten

- **Wochenansicht:** Vertikale Liste der Wochentage. Swipe links/rechts fuer Wochenwechsel.
- **Tages-Eintrag:** Datum, Von-Bis Zeiten, Projekt-Badge (farbig), Ist/Soll-Balken.
- **Detail-Sheet:** Tap auf Eintrag oeffnet Bottom Sheet mit Details + "Korrektur beantragen" Button.
- **Wochen-Summary:** Oben fixiert: Ist-Stunden, Soll-Stunden, Differenz, Ueberstunden.

### Tab 3: Antraege

- **Liste:** Segmented Control: "Meine Antraege" / "Neuer Antrag".
- **Antrags-Karte:** Typ-Icon + Datum/Zeitraum + Status-Badge (Offen=Gelb, Genehmigt=Gruen, Abgelehnt=Rot).
- **Erstellen:** Typ-Auswahl (Urlaub/Krank/Homeoffice/Korrektur), DateTimePicker (native), Notiz-Textfeld, Absenden-Button.
- **Pull-to-Refresh** fuer Updates.

### Tab 4: Team

- **Team-Status:** Karten-Grid der Teammitglieder. Gruener Dot = eingestempelt, grauer Dot = nicht aktiv, Badge fuer Abwesenheitstyp.
- **Schichtplan:** Toggle zwischen Status und Schichtplan. Kompaktes Wochen-Grid farbcodiert nach Schicht-Template. Nur sichtbar fuer User mit `team`-Scope.

### Tab 5: Profil

- **Header:** Avatar + Name + Abteilung + Rolle.
- **Gleitzeit:** Aktueller Saldo + Mini-Sparkline der letzten 4 Wochen.
- **Resturlaub:** Anspruch / Genommen / Rest.
- **Einstellungen:** Biometrie-Toggle, Push-Einstellungen (Kategorien einzeln schaltbar).
- **Abmelden-Button** (mit Bestaetigung).

---

## 6. API-Integration & Daten-Flow

### API Client (lib/api.ts)

Axios-Instanz mit BaseURL aus Environment-Variable (`EXPO_PUBLIC_API_URL`). Request-Interceptor haengt Access-Token an. Response-Interceptor:
1. Bei 401: Refresh-Token nutzen fuer neuen Access-Token
2. Original-Request wiederholen
3. Bei erneutem 401: Logout

Alle API-Calls als typisierte Funktionen:

```typescript
// Stempeln
postStamp(projectId?: string): Promise<TimeEntry>
getCurrentEntry(): Promise<TimeEntry | null>

// Zeiten
getTimeEntries(week: string): Promise<TimeEntry[]>
getFlexBalance(): Promise<{ minutes: number }>

// Antraege
getRequests(): Promise<Request[]>
createRequest(data: CreateRequestDTO): Promise<Request>

// Team
getTeamStatus(): Promise<TeamMember[]>
getShifts(week: string): Promise<Shift[]>

// Auth
login(email: string, password: string): Promise<AuthTokens>
exchangeDeviceToken(token: string): Promise<AuthTokens>
refreshToken(token: string): Promise<AuthTokens>
registerDevice(pushToken: string): Promise<void>
```

### State Management (Zustand)

Drei Stores:

**useAuthStore:**
- `user`, `accessToken`, `refreshToken`, `biometrieEnabled`, `deviceId`
- Actions: `login()`, `logout()`, `refresh()`, `setBiometrie()`

**useTimeStore:**
- `currentEntry`, `weekEntries`, `flexBalance`, `offlineQueue`
- Actions: `stamp()`, `loadWeek()`, `syncOffline()`

**useTeamStore:**
- `members`, `shifts`
- Actions: `loadStatus()`, `loadShifts()`

### Caching-Strategie

| Daten | Cache | Refresh |
|-------|-------|---------|
| Team-Status | 5 Min stale-while-revalidate | Pull-to-Refresh |
| Schichtplan | 5 Min stale-while-revalidate | Wochenwechsel |
| Zeiteintraege | Kein Cache | Bei Tab-Focus immer fresh |
| Profil/Gleitzeit | Beim App-Start | Manueller Refresh |
| Antraege | 1 Min | Pull-to-Refresh + nach Erstellen |

---

## 7. Offline-Faehigkeit

### Stempel-Queue

1. Stempel-Aktion wird **immer** zuerst lokal gespeichert (`expo-secure-store` als JSON-Array)
2. UI reagiert sofort (Optimistic Update im Zustand Store)
3. Im Hintergrund: API-Call versuchen
4. Bei Erfolg: Aus Queue entfernen
5. Bei Fehler (Offline): In Queue belassen, Badge-Counter anzeigen

### Sync-Mechanismus

- `NetInfo`-Listener erkennt Reconnect
- Queue wird FIFO abgearbeitet
- Jeder Eintrag: `{ type: 'IN'|'OUT', timestamp: ISO, projectId?: string }`
- Server-Zeitstempel gewinnt bei Konflikten
- User wird per In-App-Alert ueber Konflikte informiert

### Offline-Anzeige

- Globaler Banner oben: "Offline — Stempel werden gespeichert"
- Badge auf Stempel-Tab: Anzahl ausstehender Stempel
- Gespeicherte Stempel in Zeiten-Tab als "Ausstehend" markiert (gestrichelter Rahmen)

---

## 8. Push Notifications

### Setup

1. Beim Login: `expo-notifications` Token generieren
2. Token + deviceId an `/api/auth/devices` senden
3. Server speichert Push-Token pro Device

### Notification-Typen

| Typ | Trigger | Deep Link |
|-----|---------|-----------|
| Antrag genehmigt | Status-Aenderung | → Antraege-Tab |
| Antrag abgelehnt | Status-Aenderung | → Antraege-Tab |
| Schichtaenderung | Shift-Update | → Team-Tab |
| Ausstempel-Erinnerung | 10h nach Einstempeln | → Stempel-Tab |
| Neue Nachricht | Team-Nachricht | → Team-Tab |

### Handler

Notification-Tap oeffnet relevanten Tab via Expo Router Deep Linking:
```
timemanager://tabs/antraege
timemanager://tabs/team
timemanager://tabs
```

---

## 9. Testing & Release

### Testing-Strategie

- **Unit Tests (Jest):** Stores, API-Funktionen, Offline-Queue-Logik
- **Component Tests (RNTL):** Stempel-Button, Login-Flow, Antrags-Formular
- **E2E Tests (Maestro):** Login → Stempeln → Ausstempeln, Antrag erstellen, Team laden
- Kein 100%-Coverage-Ziel — Fokus auf geschaeftskritische Pfade

### Build-Profile (EAS)

| Profil | Zweck | Trigger |
|--------|-------|---------|
| development | Dev-Client mit Debugging | Lokal |
| preview | Interner Test via QR-Code | Push auf main |
| production | Store-Ready | Git Tag |

### Release-Strategie

1. **iOS:** TestFlight Beta (Vorstand + Teamleiter) → App Store
2. **Android:** Internal Testing Track → Production
3. **OTA Updates:** Expo Updates fuer JS-Changes ohne Store-Review
4. **Native Changes:** Voller Store-Review-Zyklus

### Monitoring

- **Sentry** (`expo-sentry`) fuer Crash-Reporting
- Custom Events: Stempel-Frequenz, Offline-Sync-Rate, Login-Methode
- Kein externes Analytics-SDK (Datenschutz)

---

## 10. Neue API-Endpunkte (Backend-Erweiterungen)

Fuer die Mobile App muessen folgende Endpunkte im bestehenden Next.js-Backend ergaenzt werden:

### Auth-Endpunkte

```
POST   /api/auth/device-token      — QR-Token generieren (Admin)
POST   /api/auth/device-exchange    — QR-Token gegen JWT tauschen
POST   /api/auth/devices            — Device + Push-Token registrieren
DELETE /api/auth/devices/:id        — Device abmelden
POST   /api/auth/refresh            — Refresh-Token erneuern
```

### Bestehende Endpunkte (keine Aenderung noetig)

```
POST   /api/stamps                  — Stempeln (bereits vorhanden)
GET    /api/time-entries            — Zeiteintraege (bereits vorhanden)
GET    /api/requests                — Antraege (bereits vorhanden)
POST   /api/requests                — Antrag erstellen (bereits vorhanden)
GET    /api/team/members            — Team-Status (bereits vorhanden)
GET    /api/shifts                  — Schichtplan (bereits vorhanden)
GET    /api/reports/flex-balance    — Gleitzeit (bereits vorhanden)
```

---

## 11. Design-Richtlinien

### Farben

Gleiche CSS-Variablen wie Web-App, uebersetzt in Nativewind:
- Primary: Blau (Stempel-Button aktiv, Links, Aktionen)
- Destructive: Rot (Ausstempeln, Abgelehnt-Badge)
- Success: Gruen (Einstempeln, Genehmigt-Badge)
- Muted: Grau (Sekundaertext, Inaktiv)
- Background/Card: Dunkler Hintergrund (Dark Mode Default)

### Typografie

- System Font (San Francisco auf iOS, Roboto auf Android)
- Groessen: 12 (Caption), 14 (Body), 16 (Subtitle), 20 (Title), 28 (Hero-Timer)

### Animationen

- Stempel-Button: Lottie Pulse-Animation bei laufender Buchung
- Screen-Transitions: Expo Router Default (Stack: slide, Tabs: fade)
- Haptic Feedback: Bei Stempel-Aktionen (`expo-haptics`)
- Skeleton Loading: Fuer alle Daten-Screens
