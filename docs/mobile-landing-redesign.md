# Mobile landing page redesign

Scope: the homepage on phones. Desktop composition, page content, navigation destinations, plan access and backend behavior are retained.

The previous phone page still stacked desktop marketing elements: an oversized headline, equal-weight outlined actions, tiny preview text, separate document/progress cards and floating approval/break badges. The footer's provider names read as ordinary text links.

Changes:

- A native welcome-screen hierarchy with a 32–40px title and readable 16px description.
- A single full-width primary action, followed by a quiet secondary action. The primary action is visible without scrolling at 320×568.
- One rounded preview card: document header, readable 15px sample text, session progress, a 44px Pause/Resume control and a subordinate break-information row. Nothing overlaps the document.
- The mobile sample is a shorter excerpt; the complete desktop sample is preserved. The preview remains explicitly an example, and its button only changes that local example.
- Three balanced benefit captions and two 48px provider links, followed by compact legal navigation. The existing flat blue surfaces and dark theme are preserved; no outer background or gradient is added.

At 390×844 the primary action and complete preview fit on the first screen. At the smaller 320×568 size, content scrolls naturally while the primary action remains visible initially. Screenshots were reviewed at 320, 390 and 430px in light and dark themes. This is browser emulation, not physical-iPhone testing.

Regression coverage in `web/e2e/mobile-landing.spec.ts` checks first-screen action placement, action hierarchy, preview bounds, readable sample size, Pause/Resume, navigation and accessibility in both themes. Existing desktop homepage tests continue to validate its composition.

Validation: all 120 browser tests passed. After the final caption/button refinements, the static build, TypeScript and SEO checks passed, followed by all 18 focused landing/homepage/mobile regression tests. No existing test assertions were changed or skipped. No backend or database changes were needed.
