# Design System — VisualMind

## Product Context
- **What this is:** A 3D spatial mind-mapping tool where users place and connect typed concept nodes in a navigable 3D scene.
- **Who it's for:** Individual thinkers — researchers, writers, engineers mapping complex idea spaces.
- **Space/industry:** Personal knowledge tools / spatial computing / concept mapping
- **Project type:** Web app (fullscreen canvas + floating chrome)

## Aesthetic Direction
- **Direction:** Retro-Futuristic Instrument
- **Decoration level:** Minimal — the 3D scene is the decoration. Chrome elements dissolve into the background.
- **Mood:** Mission control, not productivity app. The UI feels like it belongs in 3D space rather than sitting on top of it. Precise, purposeful, slightly cold — like a thinking instrument should be.

## Typography
- **UI / Labels / Toolbar:** Geist — clean, geometric, excellent at small sizes in dark UIs; designed for developer tools and performs beautifully as a general precision-UI font.
- **Node text (3D + panel field values):** Geist Mono — monospace reinforces the "structured thought" vibe; every idea is a precise artifact. Used for node labels rendered in 3D and data readouts.
- **Panel body / descriptive text:** DM Sans — just enough warmth to stay readable at length in side panels, empty states, and tooltips.
- **Code:** Geist Mono (same as node text)
- **Loading:** Google Fonts CDN
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap" rel="stylesheet" />
  ```
- **Scale:**
  | Token | Size  | Usage                        |
  |-------|-------|------------------------------|
  | xs    | 10px  | Labels, badges, kbd hints    |
  | sm    | 11px  | Toolbar buttons, field labels|
  | base  | 13px  | Panel body, inputs           |
  | md    | 15px  | Panel headings               |
  | lg    | 18px  | Section headings             |
  | xl    | 28px+ | Display / hero               |

## Color

### Approach: Chromatic — per-node colors bleed from 3D space into UI chrome

Each node type owns a color. That color appears on the 3D sphere, the toolbar button active state, panel badges, and any UI element representing that type. The canvas and surface remain near-black to keep the chromatics vivid.

| Token         | Hex        | Usage                                      |
|---------------|------------|--------------------------------------------|
| `--bg`        | `#0A0A0E`  | Canvas background                          |
| `--bg-elevated` | `#0F0F16` | Panels, dropdowns                         |
| `--surface`   | `rgba(255,255,255,0.05)` | Frosted-glass UI elements   |
| `--border`    | `rgba(255,255,255,0.09)` | Default borders                |
| `--border-strong` | `rgba(255,255,255,0.16)` | Focused / prominent borders |
| `--text`      | `#E8E8F0`  | Primary text                               |
| `--text-muted`| `#66667A`  | Secondary text, hints                      |
| `--text-faint`| `#3A3A4A`  | Placeholder, disabled, metadata            |

### Node type colors
| Type      | Hex       | Notes                                      |
|-----------|-----------|--------------------------------------------|
| Answer    | `#3B9EFF` | Electric blue — the "resolution" color     |
| Question  | `#F5A623` | Amber — uncertainty, things to explore     |
| Note      | `#3ECFB2` | Teal — neutral context, supporting info    |
| Plus      | `#7ED321` | Lime — additive, positive evidence         |
| Minus     | `#FF6B6B` | Coral — counterpoints, tension             |
| Link      | `#A593E0` | Soft violet — semantic for "connection"    |
| Reference | `#FF9F43` | Warm orange — external sources             |

### Dark mode
This is a dark-first product. If a "light mode" is ever added, reduce saturation 15-20% on node colors and use `#F2F2F8` as the canvas background.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable
- **Scale:**

| Token | Value | Usage                     |
|-------|-------|---------------------------|
| 2xs   | 4px   | Icon padding, tight gaps  |
| xs    | 8px   | Inter-element gaps        |
| sm    | 16px  | Component internal padding|
| md    | 24px  | Section gaps              |
| lg    | 32px  | Major section spacing     |
| xl    | 48px  | Page-level spacing        |
| 2xl   | 64px  | Hero / top-of-page padding|

## Layout
- **Approach:** Floating Islands — fullscreen 3D canvas with UI elements anchored at edges.
- **Grid:** N/A for the canvas. Panels use a single-column 260px layout. No multi-column grid needed.
- **Max content width:** Panels: 260–320px. No max-width constraint on the canvas.
- **Border radius:**

| Token | Value   | Usage                            |
|-------|---------|----------------------------------|
| sm    | 4px     | Buttons, badges, inputs, alerts  |
| md    | 8px     | Cards, panels, comp cards        |
| lg    | 12px    | Large surface containers         |
| pill  | 9999px  | Toolbar, toggle chips            |

Instruments have edges. Avoid bubbly 16px+ radii on non-pill elements.

## Motion
- **Approach:** Intentional — every animation serves comprehension. No decorative motion.
- **Easing:**
  - Enter: `ease-out` (elements arrive quickly, settle softly)
  - Exit: `ease-in` (elements depart decisively)
  - Move: `ease-in-out` (smooth repositioning)
- **Duration:**

| Token  | Range     | Usage                               |
|--------|-----------|-------------------------------------|
| micro  | 50–100ms  | Hover states, color transitions     |
| short  | 150–200ms | Button feedback, badge appear       |
| medium | 200–300ms | Panel slide, node spring-in         |
| long   | 400–600ms | Camera ease (handled by Babylon)    |

- **Node placement:** Spring easing, 200ms — node pops into the scene with slight overshoot.
- **Panel:** Slides in from right with `ease-out`, 200ms.
- **Connection trace:** Draws from source to target over 250ms.

## Design Risks (intentional departures)
These are deliberate choices that differ from category norms — keep them:

1. **Monospace for all UI text** — Geist Mono for node labels reinforces the "structured thought" instrument feel. Most non-dev tools use sans-serif everywhere. This is the right call for VisualMind.
2. **Node color bleeds into toolbar active state** — When Answer mode is active, the toolbar button glows `#3B9EFF`. When Question is active, it glows `#F5A623`. The chrome speaks the same color language as the 3D scene.
3. **Sharp corners (4–12px radius)** — Instruments have edges. No bubbly default-radius cards. See: Linear, Raycast, Warp.

## Decisions Log
| Date       | Decision                              | Rationale                                                   |
|------------|---------------------------------------|-------------------------------------------------------------|
| 2026-03-21 | Initial design system created         | Created by /design-consultation based on codebase analysis  |
| 2026-03-21 | Retro-Futuristic Instrument aesthetic | Fits single-user precision thinking tool; dark canvas first |
| 2026-03-21 | Geist + Geist Mono + DM Sans stack    | Geist: technical UI; Mono: node precision; DM Sans: warmth  |
| 2026-03-21 | Per-node chromatic color system       | Each type gets a color that bleeds from 3D into chrome      |
| 2026-03-21 | Desktop + tablet target               | Touch gestures matter; no tiny hit targets                  |
