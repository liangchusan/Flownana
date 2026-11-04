# Login dialog design QA — 2026-11-02

final result: passed

Reference: output/design/login-dialog-20261102/selected-option-2-refined-v1.png (1487 × 1058).
Rendered: output/playwright/login-dialog-20261102/local-desktop.png (1487 × 1058).
Combined comparison: output/playwright/login-dialog-20261102/reference-comparison.png (2974 × 1098). Visually inspected side by side.
Mobile: output/playwright/login-dialog-20261102/local-mobile.png (390 × 844).
Pricing stack: output/playwright/login-dialog-20261102/local-pricing-stack.png.

The selected two-column hierarchy, blue/gold collage, centered top brand, merged message, single Google action and legal links are present. The illustration is a standalone generated asset; text and controls are real DOM with existing Inter. Minor illustration details and spacing differ from the generated reference; no P0/P1/P2 finding remains.

History: implementation → combined reference/render comparison → confirmed image load → mobile reflow and image DOM absent → repeat interactions. No repair required after final comparison.

Verified in real local production build: sidebar; Home generation preserves prompt on cancel; Video empty prompt; Upload files; Choose from Assets; Agent send; Billing; public header; Pricing login stacks above native dialog and Escape restores Monthly pricing and focus; X/Escape/backdrop; reopen; Shift+Tab wraps; legal links new-tab/noopener; Google action disables close/repeat and navigates same tab to real account chooser; browser Back preserves draft and permits reopening.

At mobile width, scrollWidth = viewport width = 390; controls visible; creative image count zero. Emulation is not a real phone test.

Failure/retry, no OAuth/analytics preparation on open/cancel, deduplication, account intent separation and BFCache reset have targeted unit tests. Existing redirect/privacy/pricing regressions passed. Complete Google callback, actual account switching, real signup credits, analytics delivery and real phones remain manual and are not claimed by this QA result.

Production: dpl_DQtqt3re751bXRuF5hY2PnbX21aD is READY and promoted to root/www. All 411 uploaded source files match isolated-package SHA1. Production smoke passed. Screenshots: output/playwright/login-dialog-20261102/production-desktop.png (1487 × 1058), production-mobile.png (390 × 844). Actual production artwork loaded; mobile scrollWidth 390 and artwork DOM count 0. Open/close/reopen was checked online. Local full callback and production full callback were not completed on the user's behalf.
