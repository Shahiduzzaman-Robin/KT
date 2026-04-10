# Cash MGT KT Design System

Version: 1.0
Scope: Entire frontend application
Applies to: Dashboard, Ledger, Audit Logs, Users, shared components, modal and table patterns

## 1. Design North Star

Theme: Precision Architect

This product should feel like a premium financial operations tool, not a default admin template.

Principles:
- Clarity over decoration.
- High-importance numbers get strongest visual weight.
- Use tonal surface layers for structure instead of heavy borders.
- Keep interactions calm, fast, and predictable.

## 2. Canonical Palette

Use these tokens as source of truth.

- primary: #00694b
- primary_container: #008560
- surface: #f4faff
- surface_container_low: #e6f6ff
- surface_container: #d9f2ff
- surface_container_lowest: #ffffff
- on_surface: #001f2a
- on_surface_muted: #3d4a43
- success_bg: #84f8c8
- success_text: #005139
- danger_bg: #ffdad6
- danger_text: #93000a
- warning_bg: #fff3cd
- warning_text: #8a6700

Usage rules:
- Primary actions must use primary or primary gradient.
- Data-positive amounts should use primary family.
- Data-negative amounts should use danger family.
- Avoid introducing random slate/sky color systems in new UI.

## 3. Typography

Primary type system:
- Headlines and key numbers: Manrope
- Body and controls: Inter

Type scale:
- display-lg: 3.5rem, 700 (hero-level totals only)
- headline: 2rem to 3rem, 700 (page titles)
- section-title: 1.5rem, 700
- body: 0.875rem, 400-500
- label: 0.75rem, 600, uppercase with tracking

Rules:
- Financial figures should be bold and highly legible.
- Labels and metadata should use compact uppercase style.

## 4. Spacing and Radius

Spacing scale:
- compact: 4px, 8px
- medium: 16px, 24px
- large: 48px, 64px

Corner radius:
- interactive controls: rounded-xl
- cards and major containers: rounded-2xl or rounded-3xl
- avoid sharp corners

## 5. Elevation and Surface Layering

Layer model:
- Layer 0: page background (surface)
- Layer 1: grouped sections (surface_container_low)
- Layer 2: focal cards and modals (surface_container_lowest)

Shadows:
- soft, low-contrast, large blur
- avoid heavy black shadows

Borders:
- avoid strong 1px borders for section structure
- if needed for accessibility, use low-contrast outlines only

## 6. Component Contracts

### 6.1 App Shell and Sidebar

- Sidebar uses surface_container_low background with active nav pill in mint tone.
- Brand chip at top with single-letter avatar and two-line identity.
- Export action appears close to nav block, not detached at bottom.

### 6.2 Header Hero Strip

- Top accent bar gradient is allowed.
- Left side: page context label + page title.
- Right side: contextual controls (search, primary action).
- Session/action row should use compact strip style.

### 6.3 Buttons

- Primary: green gradient, rounded-xl or rounded-full for hero CTA.
- Secondary: white or surface_container tone, subtle hover shift.
- Destructive: danger_bg with danger_text.

### 6.4 Inputs and Selects

- Background: surface or white depending on section depth.
- Focus: soft 2px tint shadow using primary family.
- Labels always visible above inputs.
- Do not rely on placeholder-only fields.

### 6.5 Tables

- Header row uses surface_container_low background and uppercase micro-labels.
- Rows use tonal striping and hover tint, not hard dividers.
- Chips indicate semantic type/state (income/outgoing/success/failed).
- Row actions should remain compact and obvious.

### 6.6 Cards and Metrics

- Metric cards use generous padding and clear hierarchy.
- At most one featured card per metric block with stronger contrast.
- Remove low-value cards rather than overloading dashboard.

### 6.7 Modals

- Backdrop: dim with blur.
- Surface: white with strong title hierarchy.
- Summary block inside modal uses low-contrast tinted panel.
- Confirm/cancel actions always visible and right-aligned.

## 7. Interaction and Motion

- Hover and focus states are mandatory for clickable elements.
- Cursor pointer required on all clickable controls.
- Keep transitions short and calm (150-220ms).
- Avoid excessive animation in data-heavy sections.

## 8. Accessibility Baseline

- Maintain strong text contrast on all surfaces.
- Never communicate state by color only; pair with labels/chips.
- Preserve keyboard access for modals and dropdowns.
- Keep hit targets comfortable for desktop and mobile.

## 9. Responsive Rules

- Sidebar can remain desktop-first; ensure content remains readable when viewport narrows.
- Header controls should wrap cleanly without overlap.
- Tables must remain operable with horizontal scroll on small viewports.
- Section spacing may compress, but visual hierarchy must remain.

## 10. Approved and Deprecated Patterns

Approved:
- Token-aligned colors from this document.
- Rounded-xl to rounded-3xl surfaces.
- Tonal section backgrounds and soft shadow depth.
- Compact uppercase labels for metadata.

Deprecated for new work:
- Mixed slate and sky utility palette as primary system.
- Heavy border-first cards and table separators.
- Sharp-edged controls and inconsistent button languages.

## 11. Page Compliance Snapshot

Current alignment status:
- Home: mostly aligned
- Ledgers: mostly aligned
- Audit Logs: mostly aligned
- Users: mostly aligned

Known design debt to resolve next:
- Replace remaining legacy utility classes from src/index.css primitives with token-aligned variants.
- Standardize font import stack so Manrope and Inter are guaranteed available everywhere.
- Normalize modal spacing and button variants in every modal path.

## 12. Implementation Checklist Before Any UI Change

Before editing UI:
1. Confirm which token colors and component contract apply.
2. Reuse existing shared components when possible.
3. Keep header, card, button, input, and table styles consistent with this doc.
4. Ensure hover, focus, and pointer states are present.
5. Validate responsiveness for common desktop and narrow widths.
6. Run frontend build before finalizing.

## 13. Governance

- This file is canonical for frontend visual decisions.
- When introducing a new pattern, update this document first or in the same change.
- If a page must intentionally diverge, document the reason in the page PR/task notes.

---

Document location:
- Canonical: frontend/DESIGN.md
- Legacy inspiration/reference: frontend/Stich materials (if present)
