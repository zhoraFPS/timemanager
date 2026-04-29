# Mobile App Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Komplettes UI-Redesign der TimeManager Mobile App mit Premium Dark Glass Aesthetic, Floating Tab Bar, Bottom-Sheet Stempeln, Light/Dark Mode.

**Architecture:** Theme-Context liefert Light/Dark Tokens an alle Screens. Shared GlassCard/GlassView Komponenten kapseln Blur+Border. Custom Floating Tab Bar ersetzt Standard-Tabs. Bottom-Sheets via @gorhom/bottom-sheet. Alle bestehenden Screens werden komplett neu geschrieben.

**Tech Stack:** Expo SDK 54, React Native, Nativewind (Tailwind), expo-blur, @gorhom/bottom-sheet, react-native-reanimated, expo-haptics, lucide-react-native

---

### Task 1: Dependencies installieren + Theme-System

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/lib/theme.tsx`
- Modify: `apps/mobile/tailwind.config.js`
- Modify: `apps/mobile/app/_layout.tsx`

**Step 1: Dependencies installieren**

```bash
cd apps/mobile
npx expo install expo-blur @gorhom/bottom-sheet
```

**Step 2: Theme-Context erstellen**

Create `apps/mobile/lib/theme.tsx`:

```tsx
import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark" | "system";

interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardBorder: string;
  cardBlur: number;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryGradient: [string, string];
  secondary: string;
  destructive: string;
  success: string;
  border: string;
  glassBackground: string;
  glassBorder: string;
  tabBarBackground: string;
}

const darkColors: ThemeColors = {
  background: "#09090b",
  foreground: "#fafafa",
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.1)",
  cardBlur: 24,
  muted: "#27272a",
  mutedForeground: "#a1a1aa",
  primary: "#3b82f6",
  primaryGradient: ["#3b82f6", "#2563eb"],
  secondary: "#27272a",
  destructive: "#ef4444",
  success: "#22c55e",
  border: "rgba(255,255,255,0.08)",
  glassBackground: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.1)",
  tabBarBackground: "rgba(30,30,30,0.8)",
};

const lightColors: ThemeColors = {
  background: "#f8f9fa",
  foreground: "#09090b",
  card: "rgba(255,255,255,0.7)",
  cardBorder: "rgba(0,0,0,0.08)",
  cardBlur: 24,
  muted: "#e5e5e5",
  mutedForeground: "#6b7280",
  primary: "#2563eb",
  primaryGradient: ["#2563eb", "#1d4ed8"],
  secondary: "#e5e7eb",
  destructive: "#dc2626",
  success: "#16a34a",
  border: "rgba(0,0,0,0.06)",
  glassBackground: "rgba(255,255,255,0.7)",
  glassBorder: "rgba(0,0,0,0.08)",
  tabBarBackground: "rgba(255,255,255,0.8)",
};

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  isDark: true,
  mode: "system",
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem("themeMode").then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem("themeMode", newMode);
  };

  const isDark =
    mode === "system" ? systemScheme !== "light" : mode === "dark";

  return (
    <ThemeContext.Provider
      value={{ colors: isDark ? darkColors : lightColors, isDark, mode, setMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

**Step 3: Update `apps/mobile/app/_layout.tsx`**

Wrap the app in ThemeProvider. Import and use ThemeProvider around the Slot.

**Step 4: Verify**

Run `npx expo start`, confirm app still loads with no errors.

**Step 5: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): add theme system with light/dark mode support"
```

---

### Task 2: Glass UI Komponenten

**Files:**
- Create: `apps/mobile/components/ui/glass-card.tsx`
- Create: `apps/mobile/components/ui/glass-button.tsx`
- Create: `apps/mobile/components/ui/glass-segment.tsx`
- Create: `apps/mobile/components/ui/gradient-text.tsx`

**Step 1: GlassCard**

Create `apps/mobile/components/ui/glass-card.tsx`:

Glass card with BlurView background (expo-blur), border, border-radius. Falls back to semi-transparent View on Android. Props: children, style, className, intensity (blur amount).

On iOS: use `<BlurView intensity={40} tint={isDark ? "dark" : "light"}>` with overlay View for the glass border.
On Android: use a semi-transparent View (BlurView support is limited).

**Step 2: GlassButton**

Pressable with scale animation (Animated.View with pressIn/pressOut scaling to 0.96), haptic feedback on press (expo-haptics), glass background. Props: onPress, children, variant ("default" | "destructive" | "gradient"), disabled.

**Step 3: GlassSegment (Segmented Control)**

Horizontal pill container with N segments. Active segment as filled pill with accent color, animated sliding indicator. Props: segments (string[]), active (number), onChange.

**Step 4: GradientText**

Text component that renders with a masked linear gradient. For React Native, use `expo-linear-gradient` with MaskedView or fall back to colored text.

Actually, for simplicity, just use colored text with the primary color — true gradient text in RN requires `@react-native-masked-view` which adds complexity. Use a simple accent-colored Text component.

**Step 5: Verify**

Import GlassCard in a test screen, confirm blur effect works on iOS.

**Step 6: Commit**

```bash
git add apps/mobile/components/ui/
git commit -m "feat(mobile): add Glass UI components (GlassCard, GlassButton, GlassSegment)"
```

---

### Task 3: Floating Tab Bar + Navigation Restructure

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/components/ui/floating-tab-bar.tsx`
- Rename: `apps/mobile/app/(tabs)/index.tsx` → Home screen (was Stempeln)
- Remove: `apps/mobile/app/(tabs)/team.tsx` (merged into Home)

**Step 1: Create FloatingTabBar**

Create `apps/mobile/components/ui/floating-tab-bar.tsx`:

Custom tab bar component passed to `<Tabs tabBar={...}>`. 

Layout: Absolutely positioned at bottom, marginHorizontal 20, marginBottom 12, borderRadius 24, glass background (BlurView). Height 64.

4 regular tabs + center button:
- Tabs 1-2 on left, tabs 3-4 on right
- Center: 56px circle, gradient background (LinearGradient), elevated -16px. Plus icon when not stamped, Square icon when stamped.
- Tab icons: 22px, label 10px below
- Active tab: primary color icon + label, inactive: muted

The center button triggers navigation or opens bottom sheet (handled by parent).

**Step 2: Update Tab Layout**

Modify `apps/mobile/app/(tabs)/_layout.tsx`:

New tab structure:
1. `index` → Home (dashboard)
2. `zeiten` → Zeiten
3. `stamp` → Hidden (center button handles this via bottom sheet, not a real screen)
4. `antraege` → Anträge
5. `profil` → Profil

Use `tabBar={(props) => <FloatingTabBar {...props} />}` in Tabs.

**Step 3: Remove team.tsx**

Team status moves into the Home dashboard. Delete `apps/mobile/app/(tabs)/team.tsx`.

**Step 4: Verify**

Run app, confirm floating tab bar appears, center button is elevated, tabs navigate correctly.

**Step 5: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): floating glass tab bar with center stamp button"
```

---

### Task 4: Bottom Sheet Setup + Stempel Sheet

**Files:**
- Create: `apps/mobile/components/stamp-sheet.tsx`
- Create: `apps/mobile/components/stamp-type-card.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx` (or `app/(tabs)/index.tsx`)

**Step 1: Setup Bottom Sheet Provider**

@gorhom/bottom-sheet needs GestureHandlerRootView. Add it in `app/_layout.tsx` if not already present.

**Step 2: StampTypeCard**

Create `apps/mobile/components/stamp-type-card.tsx`:

Square glass card for each stamp type. Props: type (string), label (string), icon (LucideIcon), color (string), onPress.

Layout: GlassCard, icon centered (32px, colored), label below (12px), gradient border-left in the type color. Press animation: scale 0.96 + haptic (Selection).

**Step 3: StampSheet (Einstempeln)**

Create `apps/mobile/components/stamp-sheet.tsx`:

BottomSheet with custom glass background. Contains:
- Header: "Einstempeln" bold
- Project picker chip (optional)
- 2-column grid of StampTypeCards (7 stamp types from `@/lib/stamp-types` — need to copy this to mobile or share)
- On tap: call postStamp API → close sheet → refresh home

**Step 4: StampOutSheet**

Same component, different mode. When `isActive=true`:
- Shows running timer
- Active stamp type badge
- "Gehen" button (red gradient)
- Summary text

**Step 5: Wire up Center Button**

In the tab layout, the center button opens/closes the bottom sheet ref.

**Step 6: Verify**

Tap center button → sheet opens with stamp grid. Tap a type → stamps in, sheet closes.

**Step 7: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): stamp bottom sheet with type grid and clock-out view"
```

---

### Task 5: Home Screen (Tages-Briefing)

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/components/home/greeting-header.tsx`
- Create: `apps/mobile/components/home/shift-card.tsx`
- Create: `apps/mobile/components/home/flextime-card.tsx`
- Create: `apps/mobile/components/home/team-status-card.tsx`

**Step 1: GreetingHeader**

Time-based greeting ("Guten Morgen/Tag/Abend, {name}"), date below, notification bell right with badge.

**Step 2: ShiftCard**

Glass card showing today's work schedule. Not stamped: "Heute: 8:00 – 16:30 Uhr", empty progress bar, "8h Soll · 30min Pause". Stamped: large mono timer (48px), stamp type badge, filling progress bar, Soll/Ist numbers. Card gets subtle gradient tint matching stamp type color.

**Step 3: FlextimeCard**

Glass card with large saldo number (green/red gradient), "Gleitzeit-Saldo" label, sparkline bars for last 4 weeks.

**Step 4: TeamStatusCard**

Glass card "Wer ist da?", horizontal ScrollView of avatar circles (initials on gradient bg), green ring = online, gray = offline. Name below. "+N" overflow counter.

**Step 5: Home Screen Assembly**

ScrollView: GreetingHeader → ShiftCard → FlextimeCard → TeamStatusCard. Load data via Promise.allSettled from APIs (getActiveEntry, getFlextime, getTeamMembers, dashboard stats).

**Step 6: Verify**

Open app → Home tab shows greeting, cards with data.

**Step 7: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): home screen with greeting, shift, flextime and team cards"
```

---

### Task 6: Zeiten Screen

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/zeiten.tsx`
- Create: `apps/mobile/components/zeiten/week-day-selector.tsx`
- Create: `apps/mobile/components/zeiten/week-summary-card.tsx`
- Create: `apps/mobile/components/zeiten/day-timeline.tsx`
- Create: `apps/mobile/components/zeiten/entry-card.tsx`

**Step 1: WeekDaySelector**

Horizontal row of 7 day circles (40px). Shows day letter + number. Active day: filled gradient circle. Today: accent ring. Days with entries: colored dot below. Week label above ("7. – 13. April 2025"). Swipe gesture for week change via weekOffset state.

**Step 2: WeekSummaryCard**

Compact glass card: Ist | Soll | Differenz in a row, separated by thin borders. Differenz colored green/red.

**Step 3: DayTimeline**

Horizontal bar representing 6:00-20:00. Work blocks as colored segments (color from stamp type). Gaps for breaks. Soll-range as subtle background bar.

**Step 4: EntryCard**

Glass card for each time entry: clock-in → clock-out times, duration, stamp type badge, project badge.

**Step 5: Zeiten Screen Assembly**

WeekDaySelector fixed at top. Below: WeekSummaryCard, day headline, DayTimeline, list of EntryCards. Selected day from selector determines which entries show.

**Step 6: Verify**

Navigate to Zeiten tab, see week selector, tap days, data loads.

**Step 7: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): zeiten screen with week selector, timeline and entry cards"
```

---

### Task 7: Anträge Screen

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/antraege/index.tsx`
- Rewrite: `apps/mobile/app/(tabs)/antraege/neu.tsx` → becomes bottom sheet
- Create: `apps/mobile/components/antraege/request-glass-card.tsx`
- Create: `apps/mobile/components/antraege/new-request-sheet.tsx`

**Step 1: AnträgeScreen**

Header: "Anträge" bold headline + "+" gradient button top right.
GlassSegment control: "Offen (N)" | "Genehmigt" | "Abgelehnt".
FlatList of RequestGlassCards filtered by active segment.
Empty state: text + CTA button.

**Step 2: RequestGlassCard**

Glass card: left = colored type icon in circle, center = type label (bold) + date range (muted) + note preview, right = status badge (gradient bg).

**Step 3: NewRequestSheet**

Bottom sheet (near full screen): type chips horizontal, two date picker cards ("Von"/"Bis"), note glass input field, gradient "Absenden" button.

**Step 4: Wire up**

"+" button and empty state CTA open the new request sheet.

**Step 5: Verify**

Anträge tab shows segmented list, new request sheet opens and submits.

**Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): anträge screen with segmented tabs and new request sheet"
```

---

### Task 8: Profil Screen

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/profil.tsx`

**Step 1: Hero Header**

Avatar circle (80px) with initials on gradient bg. Name bold headline, department + employee number muted. Large flextime saldo number with color (green/red). "Gleitzeit-Saldo" label. Sparkline as background decoration.

**Step 2: Info Section**

Glass card with grouped rows: contract type, vacation days (with mini progress bar), working time model. Each row: icon + label + value.

**Step 3: Settings Section**

Glass card with toggle rows: Dark/Light mode (sun/moon icon), Biometrie (shield), Push (bell). Each as a row with label + Switch.

**Step 4: Logout**

Standalone destructive button at bottom with large margin above.

**Step 5: Verify**

Navigate to Profil, see all sections, toggle dark/light mode works.

**Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): profil screen with hero header, info and settings"
```

---

### Task 9: Cleanup + Polish

**Files:**
- Remove: `apps/mobile/components/stamp-button.tsx` (replaced by stamp sheet)
- Remove: `apps/mobile/components/project-chips.tsx` (replaced by sheet picker)
- Remove: `apps/mobile/components/gleitzeit-card.tsx` (replaced by home/flextime-card)
- Remove: `apps/mobile/components/offline-badge.tsx` (integrated into shift card)
- Remove: `apps/mobile/components/week-summary.tsx` (replaced)
- Remove: `apps/mobile/components/time-entry-card.tsx` (replaced)
- Remove: `apps/mobile/components/request-card.tsx` (replaced)
- Remove: `apps/mobile/components/request-form.tsx` (replaced by sheet)
- Remove: `apps/mobile/components/team-member-card.tsx` (integrated into home)
- Remove: `apps/mobile/components/shift-grid.tsx` (removed team tab)
- Remove debug console.logs from `apps/mobile/lib/api.ts` and `apps/mobile/app/(tabs)/index.tsx`
- Remove debug log from `src/app/api/time-entries/active/route.ts`

**Step 1: Delete old components**

Remove all files listed above.

**Step 2: Remove debug logs**

Clean up all `console.log("[API]"`, `console.log("[STEMPELN]"`, `console.log("[ACTIVE]"` lines.

**Step 3: Verify**

Run app, navigate all tabs, no errors or warnings about missing modules.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore(mobile): remove old components and debug logs"
```
