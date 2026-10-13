# Accessibility review

Automated audits use axe-core through pinned `@axe-core/playwright` 4.13.0 with WCAG 2 A/AA, 2.1 AA and 2.2 AA tags in installed Chrome. Viewports are 320, 375, 768, 1024 and 1440 px wide, 900 px tall, with reduced motion enabled. Baseline and final JSON retain state names, violations and incomplete rule IDs. This is an audit of tested states, not a WCAG conformance certification.

## Automated checks

The baseline examined dashboard, mobile drawer, patients, household editor, screening results/decision inspector, simulator, policy matrix/impact inspector, tasks/editor, coverage lists/timeline/details and renewal task editor. No violations or document/main/dialog horizontal overflow were detected. The final suite expands the inspector disclosure and adds task/event validation errors, unsaved-event confirmation and coverage editor. All five width tests require zero axe violations and zero overflow. Narrow viewports audit 19 states each; larger viewports audit 18 (drawer is hidden).

Some dialog checks remain axe `incomplete`, primarily `aria-hidden-focus` and `color-contrast`. These are review items, not passing violations silently suppressed. Radix makes the background inert/hidden and traps keyboard focus; tests explicitly verify containment and return behavior. Automated contrast results cover supported visible text states; incomplete browser-native/dialog/graphic checks still need human assistive-technology/visual review. No rule or element was excluded to produce a clean violation count.

## Keyboard checks

The desktop/mobile `e2e/readiness.spec.ts` journeys use Enter/Space, arrows, Home, Tab and Escape rather than mouse activation. Selectors wait for actual options; patient search moves focus to the result with ArrowDown. Scope helpers focus named controls to test operability; this is not a claim that every control was reached only by tabbing from the address bar.

| Workflow                       | Evidence                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Sidebar/mobile navigation      | Named navigation link activated with Enter; existing shell tests cover drawer focus trap and breakpoint resizing |
| Patient search/profile         | Keyboard name input, paginated match and profile link                                                            |
| Household editing              | Completeness checkbox with Space, explicit save and success text                                                 |
| Screening/Decision Inspector   | Search result arrows, explicit screening, Enter disclosure, Escape and return to trigger                         |
| Simulator                      | Keyboard income entry, actual comparison text and reset                                                          |
| Policy versions/population     | Native select Home/arrows, explicit analysis, Space matrix filter, inspector Escape/trigger restoration          |
| Task creation/completion       | Keyboard patient selection, coordinator assignment, lifecycle confirmation and linked profile                    |
| Coverage timeline/renewal task | Enter/Space SVG period activation, Escape restores SVG focus, reviewed deadline task save                        |

Direct, unscripted browser-tool spot checks additionally activated population analysis, matrix filtering and the impact inspector, traversed Tab/Shift+Tab inside the inspector, and opened/closed SVG period 2 in the coverage timeline. The accessibility tree confirmed focus returned to that SVG control. These checks supplement the suite; they are not testing by a human screen-reader user. Existing E2E journeys cover remaining form/disclosure interactions, missing data, history navigation and responsive layouts.

## Fixes

- Dialog focus restoration accepts connected SVG elements as well as HTML controls, with a main-content fallback when a trigger disappears.
- Textareas and disclosure summaries receive consistent visible focus outlines.
- Coverage event errors are associated with their textarea; notes expose invalid state and error description.
- Unsaved event drafts prompt before route changes or cancellation; keyboard users can keep editing or deliberately discard. Competing editor entry is disabled while the event form is open.

Existing semantic headings, captions/header scope, textual status badges, 3 × 3 matrix buttons with status/count names, SVG chronological button alternatives, form labels, live summaries, Radix modal focus containment, mobile cards and reduced-motion rules were retained. The SVG alternative provides larger native targets and exact dates; neither color nor the bar scale alone communicates eligibility/coverage.

## Limits

Chrome intermittently stalled during audit-context teardown after the assertions had passed. The harness now closes the pristine editor and explicitly disposes the page without firing unload guards before context disposal; all five tests pass with this cleanup. Unsaved-change protection is verified independently in functional tests, not bypassed during those workflows.

Axe cannot prove all WCAG criteria. No NVDA/JAWS/VoiceOver, physical touchscreen, OS high-contrast mode or user study was available. Native date-picker interaction and contrast under user themes need those environments. Scripted focus/overflow assertions do not prove every clipping, zoom, text-spacing or perceptual issue. Global/route error boundaries remain reload-based; focus behavior on a failed lazy chunk warrants future browser fault-injection coverage. No accessibility issue was waived merely to pass a test.
