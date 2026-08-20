# Flownana Design System

Status: MVP baseline
Visual direction: Claude-inspired, adapted for an image-first AI creation product
Reference: [getdesign.md Claude analysis](https://getdesign.md/claude/design-md)

This file is the visual source of truth for humans and AI coding agents. It is an adaptation of publicly observable Claude patterns, not an Anthropic asset and not an instruction to clone Claude. Preserve the Flownana name, logo, media-first product structure, and conversion funnel.

## 1. Product feeling

Flownana should feel warm, trustworthy, quiet, and capable. The interface should read like a considered creative workspace rather than a generic AI dashboard.

The visual floor is defined by:

- warm cream canvas instead of pure white or cool gray
- warm ink text instead of blue-black Slate
- restrained coral for the highest-priority action
- editorial serif display type paired with a readable humanist sans
- hierarchy through surface color and whitespace, not heavy shadows
- generated media as the dominant visual element

## 2. Precedence

When sources disagree, follow this order:

1. Current product scope and acceptance in `MEMORY.md`
2. This `DESIGN.md`
3. Existing primitives in `components/ui/`
4. Existing business blocks in `components/blocks/`
5. The closest existing page pattern

Do not introduce a new visual language from a prompt, screenshot, or generated snippet without explicit approval.

## 3. Tokens

Implementation tokens live in `app/globals.css` and are exposed through `tailwind.config.ts`. UI code must use semantic Tailwind classes rather than repeating raw values.

### Color roles

| Role | Tailwind usage | Value | Purpose |
| --- | --- | --- | --- |
| Canvas | `bg-background` | `#faf9f5` | Default page and workspace floor |
| Ink | `text-foreground` | `#141413` | Headings and primary text |
| Body | `text-stone-700` | Stone 700 | Long-form and supporting copy |
| Muted | `text-muted-foreground` | `#6c6a64` | Labels, captions, secondary copy |
| Card | `bg-card` | `#efe9de` | Feature and editorial cards |
| Soft surface | `bg-surface-soft` | `#f5f0e8` | Section bands and quiet controls |
| Strong surface | `bg-surface-strong` | `#e8e0d2` | Selected and emphasized regions |
| Hairline | `border-border` | `#e6dfd8` | Inputs, dividers, subtle outlines |
| Primary | `bg-primary` | `#cc785c` | One highest-priority CTA per region |
| Primary active | `bg-primary-active` | `#a9583e` | Primary hover and pressed state |
| Dark surface | `bg-surface-dark` | `#181715` | Media chrome, previews, footer |
| Dark elevated | `bg-surface-elevated` | `#252320` | Controls inside dark surfaces |
| Destructive | `text-destructive` | `#c64545` | Errors and destructive actions only |
| Success | `text-success` | `#5db872` | Successful or available states |
| Warning | `text-warning` | `#d4a017` | Warnings only |

Rules:

- Prefer semantic roles. Stone may be used as a compatible local neutral; Slate and Gray palettes are prohibited.
- Do not add arbitrary hex colors in JSX class names. Extend tokens when a genuinely new role is approved.
- Coral is scarce. It is for the main CTA, active focus ring, and small meaningful accents—not large decorative gradients.
- Pure white is reserved for media contrast, text on primary, and isolated input/popover surfaces where cream would reduce clarity.
- Dark surfaces frame generated media or high-contrast product moments; they are not the default page background.

### Typography

| Role | Class | Use |
| --- | --- | --- |
| Display XL | `font-display text-5xl md:text-display-xl font-medium` | Landing hero only |
| Display LG | `font-display text-4xl md:text-display-lg font-medium` | Major marketing section headings |
| Display MD | `font-display text-3xl md:text-display-md font-medium` | Page and workspace titles |
| Display SM | `font-display text-display-sm font-medium` | Card and callout headlines |
| UI title | `font-sans text-lg font-medium` | Functional panels and dialogs |
| Body | `font-sans text-base leading-relaxed` | Default reading text |
| Small body | `font-sans text-sm leading-relaxed` | Supporting text |
| Label | `font-sans text-sm font-medium` | Inputs and controls |
| Caption | `font-sans text-xs font-medium` | Metadata and fine print |
| Code | `font-mono text-sm` | Technical output only |

Display type is `Cormorant Garamond`, an open substitute for Claude's licensed editorial faces. Body type is `Inter`. Use display type for marketing and prominent page titles; keep dense product controls in sans-serif.

### Shape, spacing, and depth

- 4px is the base spacing unit. Prefer Tailwind's 2/3/4/6/8/12/16/24 spacing steps.
- Page container: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`.
- Marketing section rhythm: `py-16 md:py-24`.
- Workspace panels: 24–32px desktop padding, 16–20px mobile padding.
- Standard controls use `rounded-ui` (8px).
- Content cards use `rounded-ui-lg` (12px).
- Large media and hero frames use `rounded-ui-xl` (16px).
- Pills and circular icon buttons may use `rounded-full`.
- Prefer no shadow. Use `shadow-soft` for hover separation and `shadow-float` only for dialogs or floating popovers.

## 4. Core component contracts

Always search `components/ui/` before writing an interactive primitive. Extend a component with a variant before duplicating its markup.

### Button

- Primary: coral background, white text, 8px radius, 40px standard height.
- Secondary: cream canvas, warm hairline, ink text.
- Ghost: transparent until hover.
- Destructive: semantic destructive color only.
- All variants require visible focus, disabled, hover, and active states.
- Use one primary action per card, panel, or viewport region.

### Input and textarea

- Warm canvas or white surface, hairline border, 8px radius.
- Focus uses the coral semantic ring; never remove focus indication.
- Labels remain visible above controls. Placeholders are examples, not labels.
- Validation copy explains what happened and how to continue.

### Card

- Editorial/marketing card: `bg-card`, generally no border and no shadow.
- Functional card: `bg-background border border-border`.
- Dark media card: `bg-surface-dark text-background`.
- Avoid nesting more than two visible card surfaces.

### Navigation and tabs

- Navigation is quiet; selected state uses surface color and ink, not a bright filled pill everywhere.
- Desktop header height is 64px. Mobile controls must keep a minimum 44px touch target.
- Tabs use semantic surface changes plus a clear text-color change.

### Generated media

- The result is the visual center of creation and history surfaces.
- Use neutral or dark framing that does not color-cast the image.
- Preserve aspect ratio; never stretch generated media.
- Keep actions adjacent to the result without covering important content.

## 5. Page templates

### Landing

1. 64px navigation
2. One thesis-driven hero with one primary CTA
3. Real product or generated-media proof
4. Feature explanation in a one-column mobile / three-column desktop grid
5. Trust or examples
6. Pricing and FAQ as needed
7. Dark footer

Use editorial display type and generous whitespace. Do not default to purple gradients, floating glass cards, or decorative blobs.

### Creation workspace

1. Global top bar
2. Compact creation navigation
3. Parameter/form panel
4. Result panel with explicit empty, generating, success, and failure states

The workspace is mobile-first: panels stack on small screens and may split at desktop widths. Functional density is allowed, but visual tone remains warm and quiet.

### Pricing

- One-column mobile, up to three columns desktop.
- Default cards use canvas/hairline styling.
- A featured plan may use a dark surface or restrained coral accent, not both at full intensity.
- Price, billing period, credits, CTA, and downgrade limitations must be scannable.

### Auth, empty, loading, and error states

- Use the same canvas, type, control, and spacing tokens as the main flow.
- Skeleton geometry must match the final layout.
- Empty states lead with the next useful action.
- Errors are direct and actionable; destructive red is used only where meaning requires it.

## 6. Responsive and accessibility floor

- Start at mobile width; enhance at `sm`, `md`, and `lg`.
- Do not introduce fixed content widths such as `w-[800px]`; use `w-full` plus `max-w-*`.
- Controls must be reachable by keyboard and show `focus-visible` state.
- Maintain WCAG AA contrast for body text and controls.
- Respect `prefers-reduced-motion` for non-essential animation.
- Keep core actions at least 44px tall on touch layouts where space permits.
- Validate at 390px, 768px, and 1440px widths.

## 7. Motion

- Default interaction: `transition-all duration-300`.
- Use `active:scale-[0.98]` for press feedback where layout remains stable.
- Prefer one orchestrated motion moment over many ambient animations.
- Never let animation delay generation feedback or obscure loading/error states.

## 8. AI implementation checklist

Before coding:

1. Read `AGENTS.md`, `MEMORY.md`, and this file.
2. Identify the closest existing page, block, and primitive.
3. State which existing components will be reused.
4. Confirm whether the work changes product logic, funnel logic, or GA4 tracking.

Before finishing:

1. Run `npm run design:check`.
2. Run the validation required by `MEMORY.md` for the task's risk.
3. Inspect the changed UI at 390px and 1440px.
4. Check empty, loading, success, error, hover, focus, and disabled states that were touched.
5. Update `MEMORY.md` if the design, product flow, or tracking decision changed.

## 9. Prohibited shortcuts

- copying Claude names, marks, radial-spike glyphs, or proprietary assets
- creating a new raw button/input/card when an existing primitive fits
- using Slate/Gray palettes, purple AI gradients, heavy black shadows, or glassmorphism as defaults
- adding arbitrary JSX colors, inline `style={{}}`, or fixed desktop-only widths
- copying a generic chat product wholesale; the approved Create stream may use a right-aligned prompt and response hierarchy, but it must remain Flownana-branded, media-first, and free of invented agent-process UI
- declaring visual completion without inspecting the rendered result
