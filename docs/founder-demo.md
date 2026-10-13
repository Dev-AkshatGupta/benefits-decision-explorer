# Founder demo — 8–10 minutes

## Preparation

Use `npm run build:demo` / `npm run preview`, or a hosted URL that passed the remote suite. No public URL is recorded yet. Open `/patients` in a fresh tab. Confirm the demo banner and reset prior edits if needed. Fix screening/policy evaluation at **2026-06-15** and coverage evaluation at **2026-10-09** so examples do not drift with today's date.

Opening statement: “This independent portfolio project explores coordination workflows using entirely fictional records and policies. It is not affiliated with ITO Health and does not make real benefit determinations.” Never imply access to ITO systems/proprietary rules or real patient information.

## 1. Review a patient — 1 minute

Search **Reese Alden**, `patient-011`, and open the profile. Review household members and the complete **$0.00** annual income report. Zero is known, distinct from missing data. Briefly open household editing and cancel, or make an explicitly synthetic change and explain its tab-local lifetime. Linked tasks/coverage do not prove enrollment.

Engineering point: server pagination, debounced search/URL filters, validated contracts, protected drafts and concurrency conflicts. Global counts do not come from one visible page.

## 2. Screen and inspect — 2 minutes

Open `/eligibility?patientId=patient-011&date=2026-06-15`, retain five demonstration programs and run screening. Inspect **Demo Health Coverage (Fictional)**. Expand income: actual **$0.00**, fictional threshold **$35,000.00**, operator and explanation. Show ALL aggregation and policy version/date.

Engineering point: pure deterministic functions, stable rule references and immutable captured inputs. Explanations come from engine traces, not AI. Avery Alden's incomplete income report is an intentional missing-data fixture; an existing failure can still make an ALL result ineligible despite unknown rules.

## 3. Try a hypothetical scenario — 1–2 minutes

Open **Explore What-if Scenarios**. Enter annual income **60000**: the fixture produces **3 changed programs, 2 unchanged programs and 5 changed rules**. Expand Health: hypothetical income exceeds the unchanged $35,000 condition. Reset changes and exit; saved household income remains unchanged.

Engineering point: policy versions/date remain fixed; simulation sends no patient PATCH. Refresh requires a new baseline instead of inventing history.

## 4. Compare policy versions — 2 minutes

Open `/policies?program=demo-family&baseline=2025.1&comparison=2026.1&date=2026-06-15`. Show household size **3 → 2** and income **$40,000 → $45,000**. Three rules have modified properties, but only two change eligibility logic; references are metadata. Analyze all 150 patients.

Seeded result: **12 changed, 138 unchanged, zero errors**; ten Ineligible → Eligible and two Ineligible → Needs Information. Select a matrix cell and inspect both patient traces. Avoid implying a single cause when several rules matter. Swap versions and explicitly rerun if time permits.

Engineering point: one snapshot/date for both versions; counterfactual comparison rather than historical reconstruction. Stable IDs drive diffs; all nine transition cells reconcile, with malformed records separate.

## 5. Coordinate follow-up — 1 minute

Create a short fictional Care Task, select a patient/coordinator, start and complete it through confirmation, then show patient linkage. In Coverage & Renewals, set date 2026-10-09, search **Jordan Alden**, and open `coverage-004`/timeline. Review the September 20 deadline and March 31, 2027 recorded end. Create a reviewed renewal follow-up.

Engineering point: idempotent writes, optimistic concurrency and targeted cache synchronization. Task completion does not renew/enroll/extend coverage. Bounded program-specific gaps describe records, not actual lack of insurance.

## Close — 30 seconds

Refer to measured performance/accessibility/testing reports and production-demo tests. Discuss one measured improvement and one limit instead of an unmeasured Lighthouse score. If resetting, explain that it discards all tab-local changes/traces before confirming.

There is no authentication, shared persistence, notification delivery, official policy integration, enrollment, or regulatory certification. This prototype demonstrates explainability, domain integrity, accessibility, typed boundaries and reproducible testing.

## Production questions

Distinguish a deployable static demonstration from a clinical production system. Real use would require authorized backend contracts, authentication/authorization, verified policy governance, persistence/audit requirements, monitoring and appropriate compliance review. Refer to actual results; never claim a hosted URL or capability that has not been verified.
