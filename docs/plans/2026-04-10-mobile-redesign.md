# Mobile App Redesign: Premium Dark Glass

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Komplettes UI-Redesign der TimeManager Mobile App mit Premium Dark Glass Aesthetic, Glassmorphism, Gradient-Akzente, iOS-Native Feel. Mobile-First — Web-Dashboard wird anschließend angepasst.

**Design-Richtung:** Premium Dark Glass (transluzente Flächen, Blur-Effekte) kombiniert mit Gradient-Depth-Elementen (farbige Verläufe für Tiefe und Lebendigkeit). Light + Dark Mode.

---

## Design-System

### Glass-Card Rezept

**Dark Mode:**
- Background: `rgba(255,255,255,0.06)`
- Border: `rgba(255,255,255,0.1)`, 1px
- Backdrop: `blur(24px)`
- Innerer Glow: Subtiler `linear-gradient` Overlay oben für 3D-Effekt

**Light Mode:**
- Background: `rgba(255,255,255,0.7)`
- Border: `rgba(0,0,0,0.08)`, 1px
- Backdrop: `blur(24px)`

### Farben

- Background Dark: `#09090b` / Light: `#f8f9fa`
- Neutrales Grau-System für UI-Elemente
- Akzentfarbe: Blue Gradient (`#3b82f6` → `#2563eb`)
- Farbige Gradients nur für Stempelarten und Status-Badges
- Später konfigurierbar pro Verein (aktuell VfL Bochum)

### Stempelart-Farben

| Typ | Farbe | Icon |
|-----|-------|------|
| Kommen | Blau | Briefcase |
| Mobiles Arbeiten | Violett | Laptop |
| Heimspiel | Grün | Stadium (Landmark) |
| Auswärtsspiel | Orange | Bus |
| Dienstreise | Gelb | Plane |
| Fortbildung | Cyan | GraduationCap |
| Corp. Volunteering | Pink | Heart |

### Typografie

- SF Pro (iOS System Font) — via React Native Default
- Headlines: Bold, großzügig
- Body: Medium Weight
- Zahlen/Timer: Monospace (tabular-nums)
- Großzügiger Whitespace

### Animationen

- Spring-Animations für Übergänge (react-native-reanimated)
- Subtile Scale-on-Press (0.96) für alle tappbaren Elemente
- Haptic Feedback bei Stempel-Aktionen
- Blur-Transitions bei Moduswechsel (eingestempelt <-> ausgestempelt)
- Bottom-Sheet: Spring-Animation open/close

---

## Navigation: Floating Glass Tab Bar

### Layout

4 Tabs + erhöhter Center-Button. Bar schwebt 12px über Safe-Area-Rand, border-radius 24px, Glassmorphism-Background (stärkerer Blur als Content-Cards).

### Tabs

1. **Home** — House-Icon + "Home" (Dashboard/Tages-Briefing)
2. **Zeiten** — Calendar-Icon + "Zeiten"
3. **[Stempeln]** — Übergroßer runder Button (56px), ragt 16px über Bar hinaus, Gradient-Background (blau→violett), Plus-Icon wenn ausgestempelt / Square-Icon wenn eingestempelt. Pulsierender Ring-Glow bei aktivem Stempel.
4. **Anträge** — FileText-Icon + "Anträge"
5. **Profil** — User-Icon + "Profil"

### Verhalten

- Aktiver Tab: Label-Farbe = Akzent, Icon bekommt leichten Glow
- Center-Button ausgestempelt: Öffnet Stempel-Bottom-Sheet
- Center-Button eingestempelt: Öffnet Ausstempel-Bottom-Sheet

---

## Screen: Home (Tages-Briefing)

### Nicht eingestempelt

**Header (kein Card):**
- "Guten Morgen, Georg" — große Bold-Headline
- Heutiges Datum als Muted-Text
- Notification-Bell rechts oben mit Badge-Counter

**Schicht-Card (Glass):**
- "Heute: 8:00 – 16:30 Uhr"
- Leerer horizontaler Fortschrittsbalken
- "8h Soll · 30min Pause"

**Gleitzeit-Card (Glass):**
- Großer Saldo als Zahl mit Farb-Gradient (grün positiv, rot negativ)
- Mini-Sparkline der letzten 4 Wochen als kleine Balken

**Team-Status-Card (Glass):**
- "Wer ist da?" als Section-Header
- Horizontal scrollbare Avatar-Circles mit farbigem Ring (grün = da, grau = nicht da)
- Name unter jedem Avatar, max 8 sichtbar, Rest als "+3" Counter

### Eingestempelt

Die Schicht-Card transformiert sich:
- Großer laufender Timer (mono, 48px Font)
- Aktive Stempelart als farbiger Badge ("Kommen" / "Heimspiel" etc.)
- Fortschrittsbalken füllt sich live
- Soll/Ist als kompakte Zahlen
- Card-Background bekommt subtilen Farbverlauf passend zur Stempelart

Gleitzeit-Card und Team-Card bleiben unverändert darunter.

---

## Screen: Stempel Bottom-Sheet

### Einstempeln (Grid-Ansicht)

Öffnet vom Center-Button mit Spring-Animation. Glassmorphism-Background, Drag-Handle oben.

**Header:** "Einstempeln" als Bold-Headline, Projekt-Auswahl als kompakter Dropdown-Chip.

**Grid (2 Spalten):**

Jede Stempelart als quadratische Glass-Card:
- Großes farbiges Icon oben
- Label darunter
- Subtiler Gradient-Border in jeweiliger Farbe
- Press: Scale-Down (0.96) + Haptic Feedback

| Spalte 1 | Spalte 2 |
|----------|----------|
| Kommen (blau, Briefcase) | Mobiles Arbeiten (violett, Laptop) |
| Heimspiel (grün, Landmark) | Auswärtsspiel (orange, Bus) |
| Dienstreise (gelb, Plane) | Fortbildung (cyan, GraduationCap) |
| Corp. Volunteering (pink, Heart) | |

**Tap-Flow:** Card highlight → Haptic → Sheet schließt → Home wechselt zu Active-Ansicht

### Ausstempeln

Kompakteres Sheet:
- Laufender Timer
- Aktive Art als Badge
- Großer roter "Gehen"-Button mit Gradient
- Zusammenfassung: "Arbeitszeit: 7h 42min · Pause: 30min"

---

## Screen: Zeiten

### Kalender-Header (fixed)

Horizontale scrollbare Wochenleiste. 7 Tage als Circles (40px):
- Wochentag-Buchstabe oben (Mo, Di...)
- Tageszahl darunter
- Aktiver Tag: gefüllter Circle mit Akzent-Gradient
- Heute: subtiler Ring
- Tage mit Einträgen: farbiger Dot unter Circle
- Wisch-Geste links/rechts wechselt Woche
- Wochenanzeige als Headline darüber ("7. – 13. April 2025")

### Wochen-Summary (Glass-Card)

Drei Werte nebeneinander: Ist | Soll | Differenz. Differenz farbig (grün/rot).

### Tages-Detail (scrollbar)

**Headline:** "Montag, 7. April"

**Zeitstrahl:** Horizontaler Balken 6:00 – 20:00. Arbeitsblöcke als farbige Segmente (Farbe = Stempelart). Pausen als Lücken. Soll-Bereich als dezenter Hintergrund-Balken.

**Einträge als Glass-Cards:**
- Uhrzeiten (08:00 – 12:15)
- Dauer
- Stempelart-Badge
- Projekt-Badge falls vorhanden

**Leerer Tag:** Placeholder-Text "Keine Einträge"

---

## Screen: Anträge

### Header

"Anträge" als große Bold-Headline. "+"-Button rechts oben mit Gradient.

### Segmented Control (Glassmorphism-Pill)

Drei Segmente: "Offen (3)" | "Genehmigt" | "Abgelehnt"
- Aktives Segment: gefüllte Pill mit Akzent
- Slide-Animation beim Wechsel
- Counter bei "Offen"

### Antrags-Cards (Glass)

- Links: Farbiges Typ-Icon im Circle
- Mitte: Typ-Label Bold, Datumsbereich Muted, optionale Notiz abgeschnitten
- Rechts: Status-Badge mit Gradient-Background

**Typ-Icons:**
- Urlaub: blau, Calendar
- Krank: rot, Thermometer
- Homeoffice: violett, Home
- Korrektur: gelb, Clock
- Überstunden: grün, Clock
- Sonderurlaub: cyan, Calendar

### Leerer State

Illustration + "Keine offenen Anträge" + CTA "Antrag stellen"

### Neuer Antrag Bottom-Sheet

Fast-Fullscreen Glassmorphism-Sheet:
- Typ-Auswahl als horizontale Chips
- Zwei Date-Picker-Cards nebeneinander ("Von" / "Bis")
- Notiz-Feld als Glass-Input
- "Absenden"-Button mit Gradient

---

## Screen: Profil

### Hero-Header (obere ~30%)

- Avatar-Circle (80px) mit Initialen auf Gradient-Background
- Name als Bold-Headline ("Georg Faber")
- Abteilung + Mitarbeiternummer Muted ("Geschäftsstelle · #1002")
- Gleitzeit als Hero-Zahl: "+12:30 h" mit Farb-Gradient
- Label "Gleitzeit-Saldo" darüber
- Sparkline der letzten 4 Monate als dezente Background-Grafik

### Info-Section (Glass-Card)

Gruppierte Zeilen mit Icon + Label + Wert:
- Vertrag: "Vollzeit 40h"
- Urlaubstage: "18 von 28 übrig" + Mini-Progress-Bar
- Arbeitszeitmodell: "08:00 – 16:30 · 30min Pause"

### Einstellungen-Section (Glass-Card)

- Dark/Light Mode: Toggle mit Sonne/Mond-Icon
- Biometrie: Toggle mit Shield-Icon
- Push-Benachrichtigungen: Toggle mit Bell-Icon

### Logout

Separater Button, dezent Destructive-Rot, kein Card-Background. Großer Abstand nach oben.

---

## Light/Dark Mode

Umschaltbar im Profil-Tab. Alle Glass-Cards, Backgrounds, Text-Farben und Borders haben Light/Dark Varianten (siehe Design-System oben). Der Mode wird in AsyncStorage persistiert und beim App-Start geladen. Systemeinstellung als Default.

---

## Technische Umsetzungen

- **Glassmorphism:** `react-native-reanimated` + `expo-blur` (BlurView) für echten Backdrop-Blur auf iOS. Fallback auf semi-transparenten Background auf Android.
- **Floating Tab Bar:** Custom TabBar-Komponente in expo-router via `tabBar` prop.
- **Bottom-Sheets:** `@gorhom/bottom-sheet` mit Custom-Background (BlurView).
- **Animationen:** `react-native-reanimated` für Spring-Transitions, Shared Element Transitions für Card-Morphing.
- **Haptics:** `expo-haptics` für Stamp-Feedback.
- **Theme:** React Context mit Light/Dark Token-Maps, Toggle in Profil.
