---
name: Email Sender
description: A quiet, clear workspace for personalized sponsorship outreach.
colors:
  primary: "#1f765a"
  primary-deep: "#173d31"
  background: "#f5f7f5"
  surface: "#ffffff"
  foreground: "#1d2a23"
  muted: "#78857d"
  secondary-foreground: "#385246"
  border: "#e3e9e4"
  accent-soft: "#e8f3ed"
  destructive: "#b8453c"
typography:
  display:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(39px, 4.6vw, 62px)"
    fontWeight: 510
    lineHeight: 1.02
    letterSpacing: "-0.065em"
  headline:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 31px)"
    fontWeight: 560
    lineHeight: 1.15
    letterSpacing: "-0.055em"
  title:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.11em"
rounded:
  sm: "6px"
  md: "9px"
  lg: "12px"
  xl: "17px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "31px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    typography: "{typography.body}"
    height: "36px"
    padding: "0 11px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    typography: "{typography.body}"
    height: "32px"
    padding: "0 11px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "22px 23px"
---

# Design System: Email Sender

## Overview

**Creative North Star: "The Quiet Dispatch Desk"**

The interface treats sponsor outreach as careful correspondence. Its deep forest sign-in panel gives the product a distinct entry point, while the signed-in workspace returns to pale neutral surfaces, crisp green states, and restrained typography. The feeling is composed and practical: every screen makes the next sending decision easy to locate without turning the workflow into a decorative campaign.

The interface is desktop-led but keeps its sign-in and working surfaces within the viewport on narrow screens. Information density comes from compact labels, tables, and aligned form fields; generous white panels separate each task. Green signals progress, connection, and the primary action. The UI uses icons for navigation and status, with no logo asset beyond its simple outlined mail mark.

**Key Characteristics:**
- Cool, near-white work surfaces framed by forest green.
- Compact Geist typography with strongly tracked utility labels.
- Thin borders and small, functional shadows establish grouping.
- Green states communicate readiness and successful connection.

## Colors

The palette pairs a muted emerald action color with soft green-tinted neutrals and a darker forest entry surface.

### Primary
- **Workspace Emerald** (`{colors.primary}`): Primary buttons, selected navigation, active workflow steps, and successful or connected states.
- **Forest Panel** (`{colors.primary-deep}`): The dark sign-in story surface and its high-contrast identity area.

### Neutral
- **Mist Canvas** (`{colors.background}`): The signed-in workspace background.
- **Paper Surface** (`{colors.surface}`): Cards, forms, and navigation surfaces.
- **Ink Green** (`{colors.foreground}`): Main text, chosen for clear contrast without pure black.
- **Quiet Sage** (`{colors.muted}`): Supporting copy, captions, and secondary information.
- **Soft Divider** (`{colors.border}`): Fine card, field, and navigation boundaries.
- **Pale Mint** (`{colors.accent-soft}`): Selected navigation and low-emphasis green states.
- **Brick Error** (`{colors.destructive}`): Destructive controls and error feedback.

### Named Rules
**The Green Means Ready Rule.** Reserve saturated green for the main action, selected workflow state, and positive connection or completion signals.

## Typography

**Display Font:** Geist Variable (with Geist and system sans-serif fallbacks)

**Body Font:** Geist Variable (with Geist and system sans-serif fallbacks)
**Label/Mono Font:** Geist Variable; no distinct mono family is used.

**Character:** One variable sans family keeps the interface cohesive. Tight, slightly negative tracking gives page headings identity; small, letter-spaced labels make the workflow scannable.

### Hierarchy
- **Display** (510, responsive 39–62px, 1.02 line height): Sign-in headline.
- **Headline** (560, responsive 24–31px, 1.15 line height): Workspace page title.
- **Title** (600, 15px, 1.4 line height): Section and panel titles.
- **Body** (400, 14px, 1.5 line height): Default interface text; smaller 12–13px supporting copy appears in dense panels.
- **Label** (700, 10px, 1.3 line height, 0.11em tracking): Section captions and compact utility labels, generally uppercase in the interface.

### Named Rules
**The One Sans Rule.** Use the shipped Geist family across interface roles; differentiate hierarchy with size, weight, and tracking.

## Layout

The desktop workspace uses a fixed 244px left rail and a flexible main column. A 60px top bar anchors breadcrumbs and account controls; the content column is capped at 1160px with responsive side padding. The campaign workflow aligns its stepper above a broad work panel and supporting side panels. Repeated 4, 8, 12, 16, and 24px gaps provide the compact rhythm, with approximately 31px around major content regions.

At 900px the app shell moves its navigation above the content and stacks campaign panels; at 680px the sign-in story and form become a single-column composition and the workspace compacts spacing and tables. The interface avoids fixed-width content panels that would force horizontal page scrolling.

## Elevation & Depth

Depth is mostly tonal: white panels sit on a subtly green-tinted canvas, with fine borders doing most of the grouping. Shadows stay faint on cards and controls; the sign-in letter illustration uses a larger soft shadow as a single focal object. Focus rings and state colors communicate interaction more clearly than elevation.

### Shadow Vocabulary
- **Panel lift** (`0 2px 6px rgba(34,60,41,.025)`): Barely lifts workspace cards from the canvas.
- **Letter illustration** (`0 25px 65px rgba(7,24,16,.17)`): Gives the sign-in mail preview a distinct floating quality.

## Shapes

Most UI surfaces use gently rounded corners (9–12px), with smaller radii for compact badges and controls. Cards and fields keep thin neutral borders. Status markers, avatars, and numbered workflow steps use circles; pill shapes are reserved for compact quota and status indicators. The logo mark is a rounded square rather than a circular badge.

## Components

### Buttons
- **Shape:** Compact rounded rectangles (roughly 8–9px corners); default controls are 32–36px high.
- **Primary:** Emerald fill and white text; compact horizontal padding with a small directional or task icon where useful.
- **Secondary / Ghost:** White or transparent surfaces with a quiet border or muted hover fill.
- **Hover / Focus:** Background and text shift gently on hover; keyboard focus receives a visible green outline or ring. Disabled controls reduce opacity.

### Cards / Containers
- **Corner Style:** Gently rounded (12px for main panels).
- **Background:** White on the light mist canvas.
- **Shadow Strategy:** Thin border first, faint shadow second.
- **Border:** Fine pale green-gray stroke.
- **Internal Padding:** Approximately 22–23px for task panels, with smaller 9–13px padding for compact status and connection cards.

### Inputs / Fields
- **Style:** White background, fine sage-gray stroke, and 8–9px corners.
- **Focus:** A visible green outline/ring separates keyboard focus from the resting border.
- **Error / Disabled:** Error feedback uses brick red and a pale warm surface; disabled buttons use reduced opacity.

### Navigation
- **Style:** Persistent light sidebar on desktop with compact icon-and-label rows. Hover uses a light neutral fill; the selected item uses pale mint and green text/icon. Small count pills remain subdued.

### Campaign Stepper
The four-stage campaign sequence uses numbered circles and thin connector lines. Completed steps turn pale mint, the active step becomes solid emerald with a soft outer ring, and future steps remain outlined and quiet.

## Do's and Don'ts

### Do:
- **Do** use the mist canvas and white panels to keep long forms and recipient tables calm and readable.
- **Do** use emerald consistently for the primary action, active workflow, and positive connection states.
- **Do** keep captions small and tracked while maintaining a clear 14px default body size.
- **Do** make focus visible with the existing green outline treatment.

### Don't:
- **Don't** add extra accent hues to routine workspace controls; the shipped system uses green as its sole action accent.
- **Don't** use heavy shadows to distinguish ordinary cards; borders and tonal surfaces are the primary grouping tools.
- **Don't** turn compact utility labels into body copy; preserve the clear size contrast between labels and content.
