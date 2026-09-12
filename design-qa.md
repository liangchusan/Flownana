# Runway × Flownana Design QA

final result: passed

## Evidence

- Source visual truth: https://getdesign.md/design-md/runwayml/preview
- Implementation: http://127.0.0.1:3108/
- Source evidence: getdesign Runway preview inspected on 2026-09-12; its visible system uses paper-white reading bands, black pill CTAs, neutral grey hierarchy, single-sans typography and dark media stages.
- Implementation evidence: Codex in-app browser captures of Home at 390 × 844, 768-class default viewport and 1440 × 900; Agent and mobile drawer at 390 × 844; design system at 1440 × 900.
- CSS viewport and captured pixels matched 1:1 for the 390 × 844 and 1440 × 900 checks. Device pixel density was not altered.
- State: signed-out Home, empty signed-out Agent, open mobile navigation, design-system default states.
- Console: no local-page error entries in the checked Agent and design-system states.

## Findings

No actionable P0, P1 or P2 mismatch remains in the checked states.

- Fonts and typography: Inter is the computed heading family; display and UI typography use one sans family with clear weight and scale. Home title wraps cleanly at 390px.
- Spacing and layout: Home preserves the 260px desktop sidebar and two-column mobile template grid. Scroll width equals viewport width at 390 and 1440. Composer, template rhythm and mobile drawer remain stable.
- Colors and tokens: computed body background is white, primary is `17 17 17`, and focus ring is `0 102 204`. Black actions and grey surfaces match the selected direction; blue/yellow remain controlled brand accents.
- Image quality and assets: original Flownana logo and generated template covers remain intact, sharp and uncropped. Media assets were not replaced with code-drawn substitutes.
- Copy and content: existing product copy, navigation and template names remain unchanged except the internal design-system explanation.

Focused comparison used the Home heading/Composer, template gallery, sidebar Logo/navigation,
Agent Composer and design-system color strip because those regions expose typography, action,
brand and density decisions more clearly than the full-page view.

## Comparison History

- Initial implementation showed the former semantic primary and serif display mapping in code.
- Fixes: primary moved to black, ring/link moved to brand blue, Inter became the display family,
  buttons became pill-shaped, neutral surfaces replaced warm Token values, and the Home/template
  hierarchy and design-system reference were updated.
- Post-fix evidence: Home, Agent, drawer and design-system captures show the new system without
  overflow, broken assets or unreadable controls. No further P0/P1/P2 visual fix was identified.

## Follow-up Polish

- P3: validate signed-in Agent quotes, generated media states and nested Pricing dialogs with real
  account data; these states require external/account setup and are covered by existing component behavior tests rather than the signed-out visual capture.

## Implementation Checklist

- [x] Global semantic tokens and Inter typography
- [x] Shared controls, sidebar, Home and template gallery
- [x] 390/768/1440 responsive checks
- [x] Agent empty state and mobile drawer
- [x] Lint, build, tests and design-system check
- [ ] Signed-in real-data visual acceptance by the user
