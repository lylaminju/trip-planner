---
name: TripGlance
description: A map-native itinerary planner that connects text timelines with visual routes.
colors:
  background: "#f5f7f8"
  panel: "#ffffff"
  text: "#1f2933"
  muted: "#64748b"
  line: "#d8dee4"
  accent: "#0f766e"
  active-line: "#3f4750"
  danger: "#b42318"
typography:
  caption:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  body-sm:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  body-lg:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  title-md:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  title-lg:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  headline:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "22px"
    fontWeight: 700
  headline-lg:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "24px"
    fontWeight: 700
rounded:
  tight: "4px"
  control: "6px"
  panel: "8px"
  control-large: "10px"
  card: "12px"
  card-large: "14px"
  sheet: "16px"
  hero: "18px"
  auth-card: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "6px 8px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.panel}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "7px 8px"
---

# Design System: TripGlance

## 1. Overview

**Creative North Star: "Connected Travel Console"**

TripGlance should feel like one connected planning surface: itinerary timing,
route choices, place metadata, and map context all visible without requiring the
user to study the interface. The existing product system is restrained and
task-first, using light neutral surfaces, compact controls, and a teal accent
for action and selection.

The public landing page may use a stronger brand treatment than the authenticated
planner, but it should still show the real product shape: a text timeline and
map routes working together. Avoid generic travel-site romance, decorative AI
gradients, and long marketing explanations.

**Key Characteristics:**

- Map-native and itinerary-native in the same composition.
- Short, concrete copy supported by product previews.
- Restrained product controls with enough brand contrast for public visitors.
- Clear access hierarchy: request access first, sign in second.

## 2. Colors

The current palette is a restrained light product palette with a deep teal action
accent and slate-neutral structure.

### Primary

- **Map Teal** (#0f766e): Primary action, focus ring source, selected/owner
  emphasis, and brand accent. Use sparingly so it remains meaningful.

### Neutral

- **Planner Mist** (#f5f7f8): App background and soft landing-page fields.
- **Panel White** (#ffffff): Primary content panels, controls, forms, and
  preview surfaces.
- **Ink Slate** (#1f2933): Main readable text.
- **Muted Slate** (#64748b): Secondary metadata and helper copy.
- **Route Line** (#d8dee4): Borders, dividers, and quiet structure.
- **Active Graphite** (#3f4750): Active outline and high-emphasis neutral
  selection.

### Tertiary

- **Danger Red** (#b42318): Destructive and error states only.

### Named Rules

**The Accent Means Connection Rule.** Use teal for meaningful product links:
request access, selected route, active map/timeline relationship, or focus. Do
not use teal as generic decoration.

## 3. Typography

**Display Font:** Arial, Helvetica, sans-serif  
**Body Font:** Arial, Helvetica, sans-serif  
**Label/Mono Font:** none

**Character:** The current product typography is familiar, low-friction, and
compact. It should not draw attention away from the itinerary and map.

### Hierarchy

- **Display** (700-900, landing-page `clamp()` scale): Reserved for the public
  landing hero and major brand surfaces.
- **Headline** (700, 22-24px): Page and section titles.
- **Title** (700, 15-18px): Cards, rows, dates, and preview headings.
- **Body** (400, 13-16px): Explanatory text with a 65-75ch maximum line length.
- **Label** (700, 12-13px): Form labels, badges, metadata, and compact controls.
- **Caption** (400, 11px): Fine print such as photo credits, attribution, and
  dense secondary metadata. Do not go below 11px for readable text.

### Named Rules

**The Glance First Rule.** Headings and labels should let users understand the
screen by scanning. Avoid paragraphs that explain what a product preview already
shows.

## 4. Elevation

The app uses mostly flat panels with borders. Shadows are reserved for overlays,
mobile sheets, map warnings, and temporary menus. The landing page can use
slightly stronger layering for the product preview, but should not pair every
border with a broad decorative shadow.

### Shadow Vocabulary

- **Micro Lift** (`0 1px 2px rgba(15, 23, 42, 0.08)`): Hover or open-control
  feedback.
- **Overlay Lift** (`0 12px 28px rgba(15, 23, 42, 0.14)`): Menus, pickers, and
  temporary panels.
- **Sheet Lift** (`0 -14px 34px rgba(15, 23, 42, 0.18)`): Mobile sheet depth.
- **Auth Lift** (`0 24px 60px rgba(15, 23, 42, 0.12)`): Large centered auth
  surfaces only.

### Named Rules

**The Border First Rule.** Use border and tonal contrast for structure. Use
shadow only when a surface floats above another surface or responds to state.

## 5. Components

### Buttons

- **Shape:** Compact rounded rectangle (6px), pill only for small circular or
  capsule controls.
- **Primary:** Teal background with white text for the main action.
- **Hover / Focus:** Subtle background shift, border shift, and a teal focus
  ring. Focus must remain visible on both product and landing surfaces.
- **Secondary / Ghost:** White or transparent backgrounds with slate text and
  clear border affordance.

### Chips

- **Style:** Pill-shaped metadata with muted slate text and thin borders.
- **State:** Active chips may use teal text or stronger graphite outline, not
  heavy filled color unless the state is primary.

### Cards / Containers

- **Corner Style:** 8px for product panels and 10px for larger in-panel cards
  and media (modal heroes, resolved-place cards); 12-18px for sheets, popovers,
  and landing surfaces; 20px only for large auth surfaces.
- **Background:** White panels on light neutral background.
- **Shadow Strategy:** Flat by default, lifted only for overlays or product
  preview staging.
- **Border:** Use `#d8dee4` as the default structural line.
- **Internal Padding:** 8-16px in product UI; 24px+ only on landing-page brand
  sections.

### Inputs / Fields

- **Style:** White field, 1px line border, 6-10px radius depending on context.
- **Focus:** Teal border or teal focus ring.
- **Error / Disabled:** Danger red for errors; disabled states reduce opacity
  without losing readable labels.

### Navigation

Navigation is minimal. The authenticated app favors direct page headers and
compact actions. The public landing page should use a slim header with the
TripGlance name, primary request-access action, and secondary sign-in link.

### Repeated Lists

Repeated rows should feel mechanically consistent. When adjacent list items show
variable metadata such as offsets, abbreviations, dates, counts, durations,
badges, or actions, keep comparable values in stable columns so the eye can scan
down without horizontal jitter. Prefer fixed or bounded metadata columns,
reserved optional slots, tabular numerals, and consistent text alignment over
letting each row size itself around its content.

Do not reserve oversized space for rare outliers. Size stable columns around the
longest common value and use truncation, wrapping, or secondary disclosure only
for genuinely unusual content.

## 6. Do's and Don'ts

Do:

- Show the planner and map together whenever explaining value.
- Keep landing-page sections short and visually distinct.
- Preserve real app concepts: trips, dates, places, routes, map markers.
- Support reduced motion and keyboard access.

Don't:

- Use verbose marketing text where a preview can explain the workflow.
- Build generic three-card feature grids as the main product proof.
- Use decorative gradients, fake illustrations, or placeholder travel imagery
  that competes with the planner preview.
- Imply public signup, live navigation, or real-time collaboration unless those
  flows exist.
