---
name: Email Sender
description: A quiet, clear workspace for personalized sponsorship outreach.
colors:
  primary: "#143381"
  primary-deep: "#101f44"
  background: "#f4f6f9"
  surface: "#ffffff"
  foreground: "#19242e"
  muted: "#526575"
  secondary-foreground: "#3e5875"
  border: "#dce3eb"
  accent-soft: "#eaf0f8"
  destructive: "#b8453c"
typography:
  display:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(44px, 4.2vw, 56px)"
    fontWeight: 540
    lineHeight: 1.04
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(28px, 2.5vw, 36px)"
    fontWeight: 620
    lineHeight: 1.13
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 630
    lineHeight: 1.4
  body:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0.015em"
  metadata:
    fontFamily: "'Geist Variable', Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 450
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "9px"
  lg: "14px"
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
    height: "40px"
    padding: "0 12px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    typography: "{typography.body}"
    height: "36px"
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

The interface treats sponsor outreach as careful correspondence. Its deep navy sign-in panel gives the product a distinct entry point, while the signed-in workspace uses pale blue-white surfaces, crisp navy accents, and readable typography. The feeling is composed and practical: every screen makes the next sending decision easy to locate without turning the workflow into a decorative campaign.

The interface adapts to desktop and mobile. The sign-in page fits common desktop viewports. The work area keeps its own scroll region on desktop and uses normal page scrolling on small screens. Readable labels, tables, and aligned form fields keep dense tasks clear. Navy signals active actions and selection, while red and amber retain their status meanings. Google sign-in uses Google's official multicolor G mark.

**Key Characteristics:**

- Cool, near-white work surfaces framed by deep navy.
- Readable Geist typography with clear task labels.
- Thin borders and small, functional shadows establish grouping.
- Navy accents communicate active actions and selection.

## Colors

The palette pairs a deep navy action color with soft blue-white neutrals and a darker navy entry surface.

### Primary

- **Workspace Navy** (`{colors.primary}`): Primary buttons, selected navigation, and active workflow steps.
- **Navy Panel** (`{colors.primary-deep}`): The dark sign-in story surface and its high-contrast identity area.

### Neutral

- **Mist Canvas** (`{colors.background}`): The signed-in workspace background.
- **Paper Surface** (`{colors.surface}`): Cards, forms, and navigation surfaces.
- **Navy Ink** (`{colors.foreground}`): Main text, chosen for clear contrast without pure black.
- **Quiet Blue Gray** (`{colors.muted}`): Supporting copy, captions, and secondary information. Maintain at least 4.5:1 contrast for body text.
- **Soft Divider** (`{colors.border}`): Fine card, field, and navigation boundaries.
- **Pale Blue** (`{colors.accent-soft}`): Selected navigation and low-emphasis accent states.
- **Brick Error** (`{colors.destructive}`): Destructive controls and error feedback.

### Named Rules

**The Navy Means Action Rule.** Reserve saturated navy for the main action, selected workflow state, and primary controls.

## Typography

**Display Font:** Geist Variable (with Geist and system sans-serif fallbacks)

**Body Font:** Geist Variable (with Geist and system sans-serif fallbacks)
**Label/Mono Font:** Geist Variable; no distinct mono family is used.

**Character:** One variable sans family keeps the interface cohesive. Slightly negative tracking gives page headings identity; clear labels make the workflow scannable.

### Hierarchy

- **Display** (540, responsive 44–56px, 1.04 line height): Sign-in headline.
- **Headline** (620, responsive 28–36px, 1.13 line height): Workspace page title.
- **Title** (600, 15px, 1.4 line height): Section and panel titles.
- **Body** (400, 14px, 1.5 line height): Default interface text. Supporting and table metadata uses 11–13px where space is limited.
- **Label** (650, 12–13px, 1.4 line height): Form labels, section captions, and table headings.

### Plain language

Use short, direct sentences and common words. Prefer active voice and name the action in each control. Keep one main instruction in each sentence. Preserve required legal meaning, product limits, and Google permission details. This style follows ASD-STE100 guidance in part; it is not a claim of formal compliance.

### Named Rules

**The One Sans Rule.** Use the shipped Geist family across interface roles; differentiate hierarchy with size, weight, and tracking.

## Layout

The desktop workspace uses a fixed 252px left rail and a flexible main column. A 60px top bar anchors breadcrumbs and account controls; the content column is capped at 1240px with responsive side padding. The campaign workflow aligns its stepper above a broad work panel and supporting side panels. Repeated 4, 8, 12, 16, and 24px gaps provide the compact rhythm, with approximately 32px around major content regions.

At 1100px the sidebar narrows. At 900px the app shell moves its navigation above the content and stacks campaign panels. At 760px the sign-in story and form become a single-column composition and the workspace compacts spacing and tables. Tables scroll within their own containers when needed.

## Elevation & Depth

Depth is mostly tonal: white panels sit on a subtly blue-tinted canvas, with fine borders doing most of the grouping. Shadows stay faint on cards and controls. Focus rings and state colors communicate interaction more clearly than elevation.

### Shadow Vocabulary

- **Panel lift** (`0 1px 3px rgba(16,31,68,.045)`): Barely lifts workspace cards from the canvas.

## Shapes

Most UI surfaces use gently rounded corners (9–12px), with smaller radii for compact badges and controls. Cards and fields keep thin neutral borders. Status markers, avatars, and numbered workflow steps use circles; pill shapes are reserved for compact quota and status indicators. The logo mark is a rounded square rather than a circular badge.

## Components

### Buttons

- **Shape:** Compact rounded rectangles (roughly 8–9px corners); default controls are 32–36px high.
- **Primary:** Navy fill and white text; compact horizontal padding with a small directional or task icon where useful.
- **Secondary / Ghost:** White or transparent surfaces with a quiet border or muted hover fill.
- **Hover / Focus:** Background and text shift gently on hover; keyboard focus receives a visible navy outline or ring. Disabled controls reduce opacity.

### Cards / Containers

- **Corner Style:** Gently rounded (12px for main panels).
- **Background:** White on the light mist canvas.
- **Shadow Strategy:** Thin border first, faint shadow second.
- **Border:** Fine pale blue-gray stroke.
- **Internal Padding:** Approximately 22–24px for task panels, with smaller padding for compact status and connection areas.

### Inputs / Fields

- **Style:** White background, fine blue-gray stroke, and 8–9px corners.
- **Focus:** A visible navy outline/ring separates keyboard focus from the resting border.
- **Error / Disabled:** Error feedback uses brick red and a pale warm surface; disabled buttons use reduced opacity.

### Navigation

- **Style:** Persistent light sidebar on desktop with compact icon-and-label rows. Hover uses a light neutral fill; the selected item uses pale blue and navy text/icon. Small count pills remain subdued.

### Campaign Stepper

The three-stage campaign sequence uses numbered circles and thin connector lines. Completed steps turn pale blue, the active step becomes solid navy with a soft outer ring, and future steps remain outlined and quiet.

### Shared shadcn components

Use the shared shadcn Button, Card, Input, Label, Badge, and Progress components for their matching interface roles. Keep application-specific state and layout in the workspace components.

## Do's and Don'ts

### Do:

- **Do** use the mist canvas and white panels to keep long forms and recipient tables calm and readable.
- **Do** use navy consistently for the primary action and active workflow.
- **Do** keep labels clear and maintain a 14px default body size.
- **Do** write short, direct interface text with common words.
- **Do** make focus visible with the existing navy outline treatment.

### Don't:

- **Don't** add extra accent hues to routine workspace controls; the shipped system uses navy as its sole action accent.
- **Don't** use heavy shadows to distinguish ordinary cards; borders and tonal surfaces are the primary grouping tools.
- **Don't** turn compact utility labels into body copy; preserve the clear size contrast between labels and content.
