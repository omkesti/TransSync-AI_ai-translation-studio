# TransSync AI - Design System

## Core Design Tokens

### Typography
- **Primary/Headline Font:** Manrope
- **Body Font:** Inter
- **Label Font:** Inter

### Visual Aesthetics
- **Theme:** Dark Mode
- **Corner Radius:** Round (ROUND_FOUR)
- **Primary Accent:** #C6FF00

### Key Color Palette
- **Background / Surface:** `#0e0e0e`
- **Surface Variant:** `#262626`
- **Primary:** `#f3ffcd`
- **Primary Container:** `#c5fe00`
- **Secondary:** `#00e3fd`
- **Error:** `#ff7351`
- **On Surface:** `#ffffff`
- **On Surface Variant:** `#adaaaa`

---

# Design System Strategy: The Precision Engine

### 1. Overview & Creative North Star
This design system is built to transform a technical utility into a high-end, editorial translation experience. Our Creative North Star is **"The Precision Engine."**

Unlike generic productivity tools that rely on cluttered grids and heavy borders, this system treats information as a premium asset. We lean into the "crypto dashboard" aesthetic—high-density data delivered with surgical clarity. The look is achieved through intentional asymmetry, where large, bold headlines (Manrope) are offset by ultra-refined micro-copy (Inter). By utilizing overlapping glass surfaces and deep tonal layering, we create a sense of infinite digital space that feels both high-tech and authoritative.

---

### 2. Colors & Surface Architecture
The palette is rooted in the "void"—a deep charcoal and black foundation that allows our high-energy accents to vibrate.

*   **Primary Action (#C6FF00):** Use `primary_container` and `primary_fixed` for mission-critical interactions. This isn't just a color; it’s a beacon of activity against the dark background.
*   **Secondary Logic (#00e3fd):** Use `secondary` for supportive data, secondary buttons, and technical state changes.
*   **The "No-Line" Rule:** To maintain a premium feel, **1px solid borders are prohibited for sectioning.** Visual boundaries must be defined solely through background color shifts. For example, a `surface_container_low` section should sit directly against a `surface` background. The change in hex value provides the only necessary containment.
*   **Surface Hierarchy & Nesting:** Treat the UI as a physical stack.
    *   **Base:** `surface_dim` (#0e0e0e)
    *   **Low-Level Cards:** `surface_container_low` (#131313)
    *   **High-Impact Areas:** `surface_container_highest` (#262626)
*   **The Glass & Gradient Rule:** For floating elements (modals, dropdowns, or hovering tooltips), use a semi-transparent `surface_variant` with a 20px-40px backdrop-blur. Apply a subtle linear gradient from `primary` to `primary_container` (at 10% opacity) as a surface overlay to give the "glass" a tinted, high-tech soul.

---

### 3. Typography
We use a dual-typeface system to balance editorial authority with technical precision.

*   **The Authority (Manrope):** Reserved for `display` and `headline` roles. Manrope’s modern, geometric structure feels engineered. Use `display-lg` for hero headers to command attention, often with reduced letter-spacing (-0.02em) for a tighter, "locked-in" look.
*   **The Utility (Inter):** Used for `title`, `body`, and `label` roles. Inter provides maximum readability for dense translation data.
*   **Editorial Hierarchy:** Contrast is our primary tool. Pair a `headline-sm` in `on_surface` with a `label-sm` in `primary` to create an immediate sense of "Active System Status" vs. "Static Information."

---

### 4. Elevation & Depth
In this design system, depth is earned through light and translucency, not heavy shadows.

*   **The Layering Principle:** Stacking surfaces is the primary way to show importance. An inner module should use a tier one step higher than its parent (e.g., a `surface_container_high` module inside a `surface_container` area).
*   **Ambient Shadows:** If an element must "float" (like a translation pop-over), use a shadow with a blur radius of at least 40px, set to 6% opacity. Use the `on_surface` color for the shadow to ensure it feels like a natural light occlusion rather than a "drop shadow."
*   **The Ghost Border Fallback:** When high-density data requires a container, use a "Ghost Border." Apply `outline_variant` at 15% opacity. It should be felt, not seen.
*   **Precision Grids:** Implement a subtle dot-grid background using `outline_variant` at 5% opacity. This reinforces the "Engine" aesthetic, suggesting the UI is a living, calculated workspace.

---

### 5. Components

*   **Buttons:**
    *   *Primary:* `primary_container` background with `on_primary_container` text. Use `xl` (0.75rem) corner radius for a sleek, modern feel.
    *   *Secondary:* `secondary_container` with a `secondary` Ghost Border.
    *   *Tertiary/Glass:* Transparent background with backdrop-blur and an `outline_variant` border at 20% opacity.
*   **Glassmorphism Cards:** Use `surface_container_low` at 70% opacity with a `24px` backdrop-blur. Forbid the use of dividers; use `body-lg` vs `body-sm` spacing to separate header content from body content.
*   **Chips:** Use `surface_container_highest` for selection chips. When "Active," transition the background to `primary_container` and text to `on_primary_fixed_variant`.
*   **Input Fields:** Forbid the standard "box" look. Use a `surface_container_lowest` background with a bottom-only "Ghost Border." When focused, the border should glow with a `secondary` shadow.
*   **Translation Progress Bars:** Use a dual-tone approach. The background track is `surface_container_highest`, and the active indicator is a gradient from `secondary` to `primary`.

---

### 6. Do’s and Don’ts

*   **DO:** Use intentional white space. If a section feels crowded, increase the spacing rather than adding a border.
*   **DO:** Use the vibrant `primary` color (#C6FF00) for data visualizations, such as "Confidence Scores" or "Real-time Processing" pings.
*   **DON'T:** Use pure white (#FFFFFF) for body text. Use `on_surface_variant` (#adaaaa) to reduce eye strain in dark mode and reserve pure white for high-priority headlines.
*   **DON'T:** Use standard "Material Design" shadows. They feel too "Android" and not enough "High-End Studio." Stick to tonal layering and glass blurs.
*   **DO:** Experiment with asymmetry. If a dashboard has three columns, make them unequal widths (e.g., 20% / 55% / 25%) to create an editorial, customized layout.
