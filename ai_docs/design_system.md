# Design System

One Day Stronger's visual language is calm, clear, and grounded. The UI should feel like a knowledgeable friend — not a clinical form or a fitness tracker. Every decision should reduce cognitive load during moments when the user may be in pain or fatigued.

---

## Color System

### Palette

| Name | Token | Hex |
|---|---|---|
| Deep Teal | `color-deep-teal` | `#085041` |
| Primary Teal | `color-primary-teal` | `#0F6E56` |
| Accent | `color-accent` | `#1D9E75` |
| Cool White | `color-cool-white` | `#F7F8F9` |
| Surface | `color-surface` | `#E4E8EB` |
| Warm Amber | `color-warm-amber` | `#BA7517` |
| Pain Flag | `color-pain-flag` | `#E24B4A` |

### Semantic Roles

| Role | Token | Value | Used for |
|---|---|---|---|
| Background | `bg-base` | Cool White `#F7F8F9` | App background, screen backgrounds |
| Surface | `bg-surface` | Surface `#E4E8EB` | Cards, input fields, elevated containers |
| Surface Raised | `bg-surface-raised` | `#FFFFFF` | Modals, bottom sheets, floating elements |
| Primary | `color-primary` | Primary Teal `#0F6E56` | Primary buttons, active tab indicators, links |
| Primary Dark | `color-primary-dark` | Deep Teal `#085041` | Headers, pressed primary state, emphasis |
| Success / Progress | `color-success` | Accent `#1D9E75` | Progression events, phase completion, low pain range |
| Warning | `color-warning` | Warm Amber `#BA7517` | Hold-phase notifications, informational alerts, moderate pain range |
| Danger | `color-danger` | Pain Flag `#E24B4A` | Safety advisories, high pain indicators, error states, blocked actions |
| Text Primary | `text-primary` | `#1C2B27` | All primary body text |
| Text Secondary | `text-secondary` | `#4A6660` | Supporting text, metadata, captions |
| Text Disabled | `text-disabled` | `#9BAAA6` | Disabled controls, placeholder text |
| Text On Dark | `text-on-dark` | `#F7F8F9` | Text placed on Primary, Primary Dark, or Danger backgrounds |
| Border | `border-default` | `#C8D2D0` | Input field borders, dividers, card outlines |
| Border Focus | `border-focus` | Primary Teal `#0F6E56` | Focused input fields |

### Pain Scale Color Mapping

The pain scale (0–10) uses color semantically across check-in, logging, and history views.

| Range | Color | Token | Meaning |
|---|---|---|---|
| 0–3 | Accent `#1D9E75` | `color-success` | Low pain — proceed normally |
| 4–6 | Warm Amber `#BA7517` | `color-warning` | Moderate pain — modified protocol |
| 7–10 | Pain Flag `#E24B4A` | `color-danger` | High pain — safety advisory triggered |

Never use red for anything other than pain/safety signals. This ensures the color retains its meaning throughout the app.

### Contrast Notes (WCAG AA)

- `text-primary` (`#1C2B27`) on `bg-base` (`#F7F8F9`): ≥ 7:1 — passes AAA
- `text-on-dark` (`#F7F8F9`) on `color-primary` (`#0F6E56`): ≥ 4.5:1 — passes AA
- `text-on-dark` (`#F7F8F9`) on `color-danger` (`#E24B4A`): ≥ 4.5:1 — passes AA
- `text-secondary` (`#4A6660`) on `bg-base`: ≥ 4.5:1 — passes AA for normal text

---

## Typography

### Font Family

**Inter** — used for all text. Load via `@expo-google-fonts/inter`.

```
Inter_400Regular
Inter_500Medium
Inter_600SemiBold
Inter_700Bold
```

Fall back to system fonts (`-apple-system` on iOS, `Roboto` on Android) only during font load.

### Type Scale

| Style | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| Display | 32px | Bold 700 | 40px | -0.5px | Plan summary headline, onboarding titles |
| Heading 1 | 24px | SemiBold 600 | 32px | -0.3px | Screen titles |
| Heading 2 | 20px | SemiBold 600 | 28px | -0.2px | Section headers, card titles |
| Heading 3 | 17px | SemiBold 600 | 24px | 0px | Exercise names, subsection labels |
| Body Large | 17px | Regular 400 | 26px | 0px | Primary reading text, LLM explanations |
| Body | 15px | Regular 400 | 22px | 0px | Most body copy, descriptions |
| Body Small | 13px | Regular 400 | 18px | 0.1px | Captions, timestamps, metadata |
| Label | 13px | Medium 500 | 18px | 0.3px | Button text, tags, badges |
| Label Large | 15px | Medium 500 | 20px | 0.2px | Primary button text, tab labels |

### Text Style Rules

- LLM-generated explanations always use **Body Large** — these are the most important words in the app
- Medical terms are always followed by a plain-language parenthetical in **Body** or **Body Small**
- Pain scores are displayed in **Heading 2** weight — they are high-signal numbers
- Never set body copy in anything heavier than Regular; reserve Medium and SemiBold for hierarchy only

---

## Spacing

Base unit: **4px**

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight internal padding (icon + label gap) |
| `space-2` | 8px | Component internal padding, small gaps |
| `space-3` | 12px | Form field internal padding |
| `space-4` | 16px | Standard component padding, list item padding |
| `space-5` | 20px | Card padding |
| `space-6` | 24px | Section spacing within a screen |
| `space-8` | 32px | Between major sections |
| `space-10` | 40px | Screen-level vertical padding |
| `space-12` | 48px | Bottom safe area padding |
| `space-16` | 64px | Large visual breaks |

Horizontal screen padding: **`space-5` (20px)** on all main content screens.

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Badges, chips, inline tags |
| `radius-md` | 8px | Input fields, small buttons |
| `radius-lg` | 12px | Cards, panels |
| `radius-xl` | 16px | Bottom sheets, modals |
| `radius-2xl` | 24px | Large feature cards |
| `radius-full` | 9999px | Pill buttons, toggle chips, avatar |

---

## Elevation / Shadow

React Native shadows on iOS; `elevation` on Android. Keep elevation minimal — the UI should feel flat and calm, not layered.

| Level | Usage | iOS Shadow | Android Elevation |
|---|---|---|---|
| 0 | Flush to background | none | 0 |
| 1 | Cards, input fields | `shadowOffset: {0,1}, shadowOpacity: 0.06, shadowRadius: 4` | 2 |
| 2 | Bottom sheets, modals, floating action | `shadowOffset: {0,4}, shadowOpacity: 0.10, shadowRadius: 12` | 6 |
| 3 | Safety advisory overlay | `shadowOffset: {0,8}, shadowOpacity: 0.14, shadowRadius: 20` | 12 |

---

## Components

### Button

Three variants. All are full-width on mobile unless inside a multi-button row.

**Primary**
- Background: `color-primary`
- Text: `text-on-dark`, Label Large
- Height: 52px
- Border radius: `radius-md`
- Pressed state: background darkens to `color-primary-dark`
- Disabled state: background `bg-surface`, text `text-disabled`

**Secondary (Outline)**
- Background: transparent
- Border: 1.5px `color-primary`
- Text: `color-primary`, Label Large
- Same height and radius as primary
- Pressed state: background tints to `color-primary` at 8% opacity

**Destructive**
- Background: `color-danger`
- Text: `text-on-dark`, Label Large
- Used only for: acknowledging safety advisories, canceling a plan (confirm dialogs)

**Rules:**
- Touch target minimum: 44×44px
- Never place two primary buttons adjacent — one action should dominate each screen
- Loading state: replace label with an activity indicator; disable interaction

---

### Card

The primary container for surfaced content.

- Background: `bg-surface-raised` (`#FFFFFF`)
- Border radius: `radius-lg`
- Padding: `space-5` (20px)
- Elevation: Level 1
- Border: none (shadow provides depth)

Card variants:
- **Standard card** — workouts, exercises, history items
- **Phase card** — current recovery phase; add a left border 4px `color-primary` to indicate active phase
- **Event card** — plan evolution notifications (progression / regression / hold); left border matches event color (`color-success` / `color-danger` / `color-warning`)

---

### Pain Scale

Used in check-in and workout logging. Displays 0–10 as a horizontal slider with discrete stops.

- Track: `bg-surface`, height 6px, `radius-full`
- Fill: graduates from `color-success` → `color-warning` → `color-danger` based on selected value
- Thumb: 28px circle, white with 1px `border-default`, elevation level 1
- Value label: displayed above the thumb in **Heading 2**, colored to match current pain range
- Labels at endpoints: "0 No pain" and "10 Worst pain" in **Body Small**, `text-secondary`

The pain scale is the most critical interaction in the app. Never reduce it to a number input alone.

---

### Exercise Card

Used in the workout view. Displays one exercise per card.

**Header row:**
- Exercise name in **Heading 3**
- Set/rep prescription in **Body**, `text-secondary`: e.g., "3 sets × 8–12 reps"

**Detail row (horizontal, scrollable tags):**
- Load: chip with `bg-surface` — e.g., "Bodyweight" or "15 kg"
- Tempo: chip — e.g., "3-1-3"
- Rest: chip — e.g., "90s rest"

**Video link:**
- Icon + "Watch demo" label in `color-primary`, **Label**
- Tapping opens R2 video in a modal player

**Notes field (conditional):**
- Displayed only if notes exist; italic **Body Small**, `text-secondary`

In workout logging mode, the exercise card expands to include:
- Sets input: row of `sets_completed` number fields (one per set)
- Actual reps and weight per set
- Modifications text field (optional)

---

### Check-In Widget

The full-screen check-in flow appears on the Today screen before workout generation.

Structure:
1. Greeting header (Heading 1) — time-of-day aware: "Good morning, Amber"
2. Pain level section — pain scale component, label "Pain at rest right now"
3. Soreness section — pain scale component, label "Soreness at your hamstring attachment"
4. Submit button (Primary, full-width)

The widget should occupy the full screen on first open. Do not split across tabs or show navigation elements while check-in is incomplete.

---

### Safety Advisory

A non-dismissable overlay shown when safety thresholds are crossed.

- Background: `bg-surface-raised`
- Top accent bar: 4px `color-danger`
- Icon: warning icon in `color-danger`, 32px
- Title: **Heading 2**, `text-primary` — e.g., "Let's pause for a moment"
- Body: **Body Large**, `text-primary` — plain-language explanation of what triggered this
- Disclaimer: **Body Small**, `text-secondary` — the educational tool disclaimer
- CTA button: Destructive variant — "I understand, I'll seek care"
- Backdrop: dark scrim at 40% opacity; tapping outside does nothing

Never use the word "error" in safety advisories. The tone is caring, not alarming.

---

### Phase Badge

A compact indicator of the user's current recovery phase.

- Background: `color-primary` at 12% opacity
- Text: `color-primary-dark`, **Label**
- Border radius: `radius-sm`
- Example: "Phase 2 · Load Progression"

On regression events, the badge uses `color-danger` at 12% opacity with `color-danger` text.

---

### Evolution Event Banner

Appears on the Today screen and Plan screen after a plan evolution event fires.

**Progression:**
- Left border 4px `color-success`
- Icon: upward arrow, `color-success`
- Title: **Heading 3** — "You've progressed to Phase 3"
- Body: **Body** — plain-language rationale from the database

**Regression:**
- Left border 4px `color-danger`
- Icon: downward arrow, `color-danger`
- Title: "Your plan has been adjusted"

**Hold:**
- Left border 4px `color-warning`
- Icon: pause icon, `color-warning`
- Title: "Staying in Phase 2 for now"

The banner is dismissable. After dismissal it moves to History.

---

### Form Fields

Used across intake, profile, and logging.

**Text Input**
- Background: `bg-surface`
- Border: 1px `border-default`
- Border radius: `radius-md`
- Padding: `space-3` horizontal, `space-2` vertical
- Height: 48px (single line), auto-expand for multiline
- Focus state: border changes to `border-focus` (1.5px)
- Error state: border `color-danger`, error message in **Body Small** `color-danger` below field
- Label: **Label**, `text-secondary`, above the field

**Segmented Selector** (used for goal selection, irritability level)
- Row of equal-width chips with `radius-md`
- Unselected: background `bg-surface`, text `text-secondary`
- Selected: background `color-primary`, text `text-on-dark`
- Border: 1px `border-default` on unselected

**Slider** — see Pain Scale component

---

### Tab Bar

The main app's bottom tab navigation (Today, Plan, History, Profile).

- Background: `bg-surface-raised`
- Top border: 1px `border-default`
- Active icon + label: `color-primary`
- Inactive icon + label: `text-disabled`
- Label: **Label** (13px Medium)
- Touch target: full tab width × 56px height
- Today tab shows a dot indicator if check-in is pending

---

## Screen Layout Patterns

### Today Screen

```
[Screen]
  Header: "Today" (Heading 1) + date (Body Small, text-secondary)
  ─────────────────
  [Check-In Widget — always shown first if not complete]
  ─────────────────
  [Evolution Event Banner — if pending]
  ─────────────────
  [Generated Workout Card or Rest Day Card]
    └── [Exercise Cards — scrollable list]
  ─────────────────
  [Log Workout Button — Primary, sticky above tab bar]
```

### Plan Screen

```
[Screen]
  Header: "Your Plan" (Heading 1)
  ─────────────────
  [Phase Badge + Phase Card — current phase]
    └── Plain language summary (Body Large)
    └── Progression criteria summary (Body Small)
  ─────────────────
  [Phase Exercise List — prescribed, not today's workout]
```

### History Screen

```
[Screen]
  Header: "History" (Heading 1)
  ─────────────────
  [Calendar strip — week view, dots on completed sessions]
  ─────────────────
  [Session cards — reverse chronological]
    └── Date, session type, pain score at check-in
    └── Tap to expand: full exercise log
```

### Profile Screen

```
[Screen]
  Header: "Profile" (Heading 1)
  ─────────────────
  [Injury Intake section — read-only, collapsed by default]
  ─────────────────
  [Current Status section — editable]
    └── Pain baseline, current symptoms, last flare
    └── Save button triggers plan revision confirmation
  ─────────────────
  [Settings section]
    └── Notification time picker
    └── Sign out (text link, text-secondary)
```

### Onboarding Screens

Onboarding uses a full-screen step pattern with no tab bar.

- Progress indicator: step dots at top, `color-primary` filled, `bg-surface` empty
- Single primary action per screen — always full-width Primary button
- Back navigation: text link "Back" in **Label Large**, `text-secondary`, top-left
- Intake multi-step form: one question per screen where possible; group only logically related fields

---

## Motion and Animation

Keep animation minimal and purposeful. The app should never feel "bouncy" or entertainment-focused.

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Screen transitions | 280ms | `ease-in-out` | Standard React Navigation stack slide |
| Bottom sheet open | 320ms | `ease-out` | Spring stiffness: low |
| Button press feedback | 80ms | `ease-in` | Scale down to 0.97 |
| Pain scale thumb drag | Real-time | — | No animation delay on drag |
| Evolution banner appear | 240ms | `ease-out` | Fade in + 8px upward translate |
| Safety advisory enter | 200ms | `ease-out` | Fade in only — no slide |

Never use animation to delay feedback. A loading state should appear immediately; do not animate over a loading state appearing.

---

## Iconography

Use **Phosphor Icons** (`phosphor-react-native`) — available as a React Native package, consistent style, MIT licensed.

Icon sizes:
- Tab bar: 24px
- In-card actions: 20px
- Inline with text: 16px
- Safety advisory: 32px

Preferred icon choices:
- Today tab: `CalendarCheck`
- Plan tab: `ClipboardText`
- History tab: `ChartLine`
- Profile tab: `User`
- Exercise video: `PlayCircle`
- Evolution progression: `ArrowCircleUp`
- Evolution regression: `ArrowCircleDown`
- Hold phase: `PauseCircle`
- Safety advisory: `Warning`
- Rest day: `Moon`

Icons are always accompanied by a text label in tab bar and button contexts. Icon-only usage is permitted only for clearly universal affordances (e.g., back arrow, close X).

---

## Accessibility

- All interactive elements: minimum 44×44px touch target
- Color is never the sole indicator of meaning — always pair with text or icon (e.g., pain range chips use color + text label)
- All images and icons used without adjacent text labels include an `accessibilityLabel` prop
- Screen reader order follows visual order; do not reorder with z-index or absolute positioning
- Font sizes respect system accessibility font scaling — use `allowFontScaling` (default true); avoid fixed-height containers that would clip scaled text
- Focus trapping inside modals and the safety advisory overlay
- Onboarding intake multi-step: each step announces its position ("Step 2 of 5") via `accessibilityLabel`

---

## Tone and Copy Guidelines

These apply to all in-app text, including LLM output displayed to users.

- Address the user by first name in greetings and evolution events
- Use "your plan" and "your hamstring" — possessive and personal
- Avoid clinical distance: say "your hamstring attachment" not "the proximal hamstring insertion site" (or follow any clinical term with a parenthetical)
- On regression events: lead with what the user did right, then explain the adjustment — never frame regression as failure
- On safety advisories: open with acknowledgment, not alarm — "Let's take a closer look" before the recommendation
- Never use "error," "failure," "invalid," or "wrong" in user-facing copy
- Loading states always tell the user what's happening: "Generating your workout..." not just a spinner
