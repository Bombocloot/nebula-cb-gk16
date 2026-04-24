---
name: Nebula RGB Controller
description: >
  Open-source RGB controller for the Cosmic Byte CB-GK-16 Firefly keyboard.
  Dense tool-UI shell with a rich electric-purple gamer aesthetic beneath it —
  the outer frame is monochrome minimalism; every interactive surface glows
  in the brand's vivid purple-magenta hue.

colors:
  # Backgrounds & surfaces
  background:          "#000000"
  background-alt:      "#0a0a0a"
  surface:             "#111111"
  surface-deep:        "#1a1a1a"
  surface-hover:       "#2a2a2a"

  # Purple-family (brand depth scale, dark to light)
  bg-purple-darkest:   "#150b18"
  bg-purple-deeper:    "#160b19"
  bg-purple-dark:      "#1a0e1c"
  bg-purple-base:      "#1f1122"
  surface-purple:      "#2a1b2e"
  surface-purple-alt:  "#2d1b32"
  surface-purple-mid:  "#36203c"
  surface-purple-hover:"#422348"
  key-base:            "#2a152e"
  key-active:          "#5e236b"

  # Primary accent
  primary:             "#c813ec"
  primary-dark:        "#a00fbd"
  primary-intense:     "#d93ef5"

  # Text
  text-primary:        "#ffffff"
  text-muted:          "#666666"
  text-muted-purple:   "#c092c9"
  text-dim-white:      "rgba(255,255,255,0.6)"

  # Borders
  border-default:      "rgba(255,255,255,0.1)"
  border-subtle:       "rgba(255,255,255,0.05)"
  border-purple:       "#422348"

  # Semantic / status
  status-connected:    "#22c55e"
  status-live:         "#4ade80"
  status-idle:         "#eab308"
  status-error:        "#ef4444"
  accent-green:        "#0bda7a"

  # Window chrome (macOS traffic-light style)
  window-close:        "#ff5f57"
  window-minimize:     "#ffbd2e"
  window-maximize:     "#22c55e"

  # RGB palette (key paint colors)
  paint-red:           "#ff0000"
  paint-green:         "#00ff00"
  paint-yellow:        "#ffff00"
  paint-blue:          "#0000ff"
  paint-cyan:          "#00ffff"
  paint-magenta:       "#ff00ff"
  paint-white:         "#ffffff"
  paint-off:           "#000000"
  paint-orange:        "#ff8800"
  paint-violet:        "#8800ff"

  # Alpha tokens (purple glow family)
  glow-primary-faint:  "rgba(200,19,236,0.10)"
  glow-primary-soft:   "rgba(200,19,236,0.15)"
  glow-primary-mid:    "rgba(200,19,236,0.20)"
  glow-primary-base:   "rgba(200,19,236,0.30)"
  glow-primary-strong: "rgba(200,19,236,0.50)"
  glow-primary-active: "rgba(200,19,236,0.60)"
  glow-primary-hover:  "rgba(200,19,236,0.80)"

  # Alpha tokens (white family)
  white-03:            "rgba(255,255,255,0.03)"
  white-05:            "rgba(255,255,255,0.05)"
  white-10:            "rgba(255,255,255,0.10)"
  white-20:            "rgba(255,255,255,0.20)"
  white-40:            "rgba(255,255,255,0.40)"
  white-60:            "rgba(255,255,255,0.60)"
  white-70:            "rgba(255,255,255,0.70)"

typography:
  fonts:
    display: "'Space Grotesk', sans-serif"
    body:    "'Inter', sans-serif"
    ui:      "'Noto Sans', sans-serif"
    icon:    "'Material Symbols Outlined'"
    mono:    "monospace"

  weights:
    light:    300
    regular:  400
    medium:   500
    semibold: 600
    bold:     700

  sizes:
    # Compact shell (src/index.html — pixel-accurate)
    titlebar:     "11px"
    nav-tab:      "10px"
    label-xs:     "7px"
    label-sm:     "8px"
    label:        "9px"
    button:       "10px"
    key:          "5px"
    stat-value:   "18px"
    stat-kpm:     "36px"
    icon-nav:     "14px"
    icon-mode:    "16px"

    # Stitch / expanded UI (Tailwind scale)
    xs:   "12px"
    sm:   "14px"
    base: "16px"
    lg:   "18px"
    xl:   "20px"
    2xl:  "24px"
    3xl:  "30px"
    4xl:  "36px"
    5xl:  "48px"
    6xl:  "60px"

  tracking:
    titlebar:   "wider"   # NEBULA CONFIGURATOR
    nav:        "wide"
    card-title: "1px"
    body:       "normal"
    heading:    "tight"

spacing:
  # Shell geometry
  titlebar-height: "30px"
  nav-height:      "36px"
  page-pad:        "10px"
  apply-bar-pad:   "8px 10px"

  # Component spacing
  card-pad:        "10px"
  card-gap:        "8px"
  button-pad:      "6px 12px"
  toggle-size:     "28px × 16px"
  toggle-thumb:    "10px"
  swatch-size:     "22px × 22px"
  status-dot:      "5px × 5px"

  # Key widths (multiples of 20px base unit)
  key-base:      "20px × 20px"
  key-w125:      "25px"
  key-w15:       "30px"
  key-w175:      "35px"
  key-w2:        "40px"
  key-w225:      "45px"
  key-w275:      "55px"
  key-space:     "120px"

  # Gap scale
  gap-xs:   "2px"
  gap-sm:   "4px"
  gap-md:   "6px"
  gap-base: "8px"
  gap-lg:   "12px"
  gap-xl:   "15px"

radii:
  none:    "0"
  key:     "2px"
  swatch:  "3px"
  mode:    "4px"
  card:    "6px"
  input:   "3px"
  lg:      "8px"
  xl:      "12px"
  2xl:     "16px"
  pill:    "9999px"
  circle:  "50%"

shadows:
  # Shell (subtle)
  key-lit:       "0 0 8px rgba(255,255,255,0.5)"
  swatch-active: "0 0 6px currentColor"
  key-painted:   "0 0 6px <paintColor>"

  # Neon glow (purple family — used on interactive surfaces)
  glow-sm:       "0 0 10px rgba(200,19,236,0.20)"
  glow-md:       "0 0 15px -3px rgba(200,19,236,0.30)"
  glow-lg:       "0 0 20px -5px rgba(200,19,236,0.60)"
  glow-xl:       "0 0 30px -5px rgba(200,19,236,0.80)"
  glow-ambient:  "0 0 50px -15px rgba(200,19,236,0.15)"

  # Physical key (3D press effect)
  key-rest:   "0 4px 0 0 #150b18"
  key-press:  "0 2px 0 0 #3d1245"
  key-hover:  "0 5px 0 0 #150b18"

  # Per-key neon (painted keys)
  key-neon-red:     "0 0 10px #ff0000, inset 0 0 5px rgba(255,255,255,0.2)"
  key-neon-cyan:    "0 0 10px #00ffff, inset 0 0 5px rgba(255,255,255,0.2)"
  key-neon-purple:  "0 0 10px #c813ec, inset 0 0 5px rgba(255,255,255,0.2)"

motion:
  duration-fast:    "100ms"
  duration-base:    "150ms"
  duration-medium:  "200ms"
  easing-default:   "ease"
  easing-smooth:    "ease-in-out"

  transitions:
    toggle:       "background-color 200ms ease"
    key-press:    "all 100ms ease"
    button:       "all 150ms ease-in-out"
    color:        "color 150ms ease, background-color 150ms ease"
    transform:    "transform 150ms ease"
    scrollbar:    "background-color 150ms ease"

  keyframes:
    pulse-glow:
      "0%, 100%": "box-shadow: 0 0 20px -5px rgba(200,19,236,0.20)"
      "50%":       "box-shadow: 0 0 40px -5px rgba(200,19,236,0.50)"

  transforms:
    key-active:   "scale(0.95)"
    key-hover:    "translateY(-2px)"
    swatch-hover: "scale(1.1)"
    button-lift:  "translateY(-2px)"

gradients:
  stats-card:     "linear-gradient(to bottom right, #422348, #2d1b32)"
  health-bar:     "linear-gradient(to right, #c813ec, #a855f7)"
  idle-swatch:    "linear-gradient(to top right, transparent, rgba(255,255,255,0.1), transparent)"
  card-ambient:   "linear-gradient(to bottom right, rgba(200,19,236,0.05), transparent, transparent)"

elevation:
  ambient-blob:
    background: "rgba(200,19,236,0.10)"
    blur:       "80px"
    shape:      "circle"
    position:   "absolute, behind keyboard"
  card-glow:
    shadow: "0 0 50px -15px rgba(200,19,236,0.15)"
  overlay:
    background: "rgba(31,17,34,0.90)"
    blur:       "4px"

layout:
  window:
    width:  "1400px"
    height: "850px"
    frame:  false

  shell:
    titlebar:  "30px fixed, -webkit-app-region: drag"
    nav:       "36px horizontal tab bar below titlebar"
    content:   "flex:1, overflow-y auto, 10px padding"
    apply-bar: "fixed footer with status + primary action button"

  stitch-layout:
    header:  "full-width, 40–64px, logo + pill nav + avatar"
    sidebar: "256–320px fixed left, lighting mode list"
    content: "flex-1, max-width 1200px, centered cards"
    footer:  "full-width, status info + Discard/Apply actions"
---

# Nebula — Design Language

## Identity

Nebula is a keyboard RGB controller that lives at the intersection of two aesthetics: a **ruthlessly compact tool-UI shell** and an **electric purple gamer sensibility**. The outer container is almost brutally minimal — pure black, tiny text, no decoration. But every interactive surface responds with the brand's signature vivid purple-magenta glow (`#c813ec`), making the tool feel alive without ever feeling cluttered.

The name "Nebula" is the north star: deep space black with points of colored light. The keyboard itself is that nebula — dark keys that light up in user-chosen colors, rendered in the app as a miniature glow-map of the physical board.

## Color

The palette has two personalities that coexist:

**Shell / chrome:** True black (`#000`) and near-black (`#111`) for all structural surfaces. White (`#fff`) is the only accent — used for text, borders (`rgba(255,255,255,0.1)`), and interactive highlights. No color appears in the chrome itself; the UI stays out of the way of the keyboard's RGB output.

**Purple depth scale:** The design exploration layer (and the intended evolution of the UI) replaces the monochrome shell with a deep purple-black color family — eight stops from `#150b18` (near-black with a purple cast) through `#422348` (a visible purple-grey used for borders and hover states). This gives surfaces depth without using gradients everywhere.

**Primary accent (`#c813ec`):** An electric purple-magenta. Vivid enough to read against the darkest backgrounds at reduced opacity. Never used for text — only for glows, active states, borders on focus, and the Apply/Save button. Its alpha variants (0.10 → 0.80) form the entire glow system.

**RGB paint colors** are the only saturated, non-purple hues in the product: the eight keyboard LED colors (red, green, yellow, blue, cyan, magenta, white, off) used exclusively in the key-painting UI and color swatches.

## Typography

The compact shell uses **Inter** at sizes between 7px and 18px — deliberately tiny to preserve screen real estate in an 1400×850 window packed with controls. Weight 600 (semibold) is used on buttons and values; 400 on labels. Letter-spacing is +1px on card section titles (all-caps) to compensate for the small size.

The expanded design uses **Space Grotesk** for display and headings — a geometric, slightly quirky sans-serif that fits the "tech tool with personality" brief — paired with **Noto Sans** for body copy. Material Symbols Outlined provides all iconography.

## Spacing & Density

The shell is **dense by design**. A 20px base key unit, 10px card padding, 4–8px gaps. Everything is packed tightly because the user is a keyboard enthusiast who wants maximum controls visible without scrolling. Breathing room appears only where focus is needed: the keyboard visualization gets 8px padding and full-width treatment; the stats KPM counter gets 36px type.

The stitch layout relaxes this — 48px keys, 16–32px padding on panels — intended for a larger window or a future web companion.

## Glow System

The single most distinctive visual element is the **purple neon glow** applied to interactive surfaces. It works at four intensities:

- **Ambient** (`glow-ambient`): A very soft, wide halo behind cards. Almost imperceptible. Creates depth.
- **Default** (`glow-md`): Applied to selected sidebar items, active nav pills, focused direction buttons.
- **Active** (`glow-lg`): Applied to the active nav item and the Apply button at rest.
- **Hover** (`glow-xl`): Applied to the Apply button on hover — the primary call to action pulses.

The `pulse-glow` keyframe animation breathes between the faint and strong variants on persistent live indicators.

Keyboard keys in per-key painting mode get a **neon inset glow** — the painted color radiates outward with a matching outer shadow and a white inset highlight (`inset 0 0 5px rgba(255,255,255,0.2)`) that simulates the light bleeding through the key cap.

## Motion

Motion is minimal and purposeful:

- **100ms** for key press feedback (physical feel)
- **150ms** for most interactive state changes (color, hover)
- **200ms** for toggles (deliberate enough to feel like a switch)

`animate-pulse` from Tailwind marks live/connected status indicators (the green status dot, KPM live indicator). `animate-ping` provides a one-shot ripple on the live preview dot. Neither animation is decorative — both communicate "this is real-time data."

Key buttons scale down to `0.95` on press (physical keyboard feel), and lift `translateY(-2px)` on hover in the stitch layout to suggest they're pressable.

## Key Rendering

The keyboard is the product. In the compact shell, keys are 20×20px minimum — a dense but readable grid that maps the full 87-key TKL layout. In the expanded stitch designs, keys grow to 48×48px with a 3D physical shadow (`0 4px 0 0 #150b18` at rest, `0 2px 0 0 #3d1245` when pressed) that makes them feel tangible.

Lit keys receive a neon glow in the color they've been painted. Unlit keys are a deep muted purple (`#2a152e`) that reads as "off" without being invisible.

## Window Chrome

The titlebar uses macOS-style traffic-light window controls (red/yellow/green circles, 12–14px) positioned top-left, with the app title centered. The titlebar is `-webkit-app-region: drag` and frameless. This gives Nebula a clean, app-like feel rather than a native Windows tool aesthetic.

## Layout Principles

1. **Tabs over pages.** Navigation is a horizontal tab bar, not a sidebar. Every section is one click away; there is no drilling.
2. **Persistent footer action.** The Apply button and status message live in a fixed bottom bar — always accessible regardless of scroll position.
3. **Two-column grids** inside content cards pair related control groups (active color | idle color, paint tools | presets) without creating separate pages.
4. **The keyboard is always visible** on its section — never hidden behind a modal or scroll boundary.

## Component Patterns

**Cards:** Dark surface (`#111`), 6px radius, 10px padding, 8px bottom margin. Section title is 8px, all-caps, letter-spaced, dim-white. No shadow on the card itself — glow is reserved for interactive elements.

**Buttons:** Semibold 10px text, 6×12px padding, 4px radius. Primary = filled white (shell) or filled purple (stitch) with purple glow. Secondary = `rgba(255,255,255,0.05)` background, thin border.

**Toggles:** 28×16px pill. Background transitions from dim (`#333`) to white (shell) or primary purple (stitch) on enable. Thumb is a 10px white circle that slides 12px right.

**Sliders:** Range inputs styled with a 2px track and circular thumb. Track fills in white (shell) or purple (stitch) up to the thumb position.

**Color swatches:** 22×22px squares (shell) or 36×36px (stitch), 3px radius, scale 1.1 on hover. Selected swatch shows a `box-shadow: 0 0 6px currentColor` glow ring.

**Status indicator:** 5px circle with `animate-pulse`. Green = connected/active, yellow = idle, red = error. Accompanied by a short text label in 9px semibold.
