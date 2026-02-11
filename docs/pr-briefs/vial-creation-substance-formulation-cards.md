# PR Brief: Card-Based Substance/Formulation Picker for New Vials

## Goal
Replace the current "Formulation" dropdown in new-vial creation with a card-first selection flow:
- one primary card per substance
- mini formulation cards inside each substance card
- an inline "Add formulation" affordance when the needed formulation is missing

This should reduce dropdown friction and make selection faster and more understandable.

## Problem to Solve
Current vial creation relies on a long formulation dropdown, which hides the relationship between substance and formulation and is harder to scan on desktop and mobile.

## UX Requirements
- On new-vial surfaces (`/inventory` and `/setup/inventory`), show a searchable grid/list of substance cards.
- Each substance card contains:
  - substance name + high-level metadata (count of formulations, optionally stock summary)
  - mini selectable formulation cards/chips for that substance
  - an "Add formulation" button
- Selecting a mini formulation card sets `formulation_id` for vial creation.
- "Add formulation" opens a lightweight inline/modal flow (or navigates with preserved return state) to create a formulation pre-bound to the selected substance, then returns and preselects it.
- Mobile behavior must be tap-friendly and avoid horizontal overflow.

## Technical Notes
- Preserve existing server action behavior in `web/src/app/(app)/(hub)/inventory/actions.ts` and `web/src/app/(app)/setup/actions.ts`.
- This PR should primarily refactor form UI components:
  - `web/src/app/(app)/(hub)/inventory/create-vial-form.tsx`
  - `web/src/app/(app)/setup/inventory/page.tsx` (and related setup form components)
- Reuse existing repos/data loaders for substances/formulations instead of introducing duplicate queries.
- Add stable `data-e2e` selectors for:
  - substance card
  - formulation mini card
  - add formulation CTA

## Acceptance Criteria
- No formulation dropdown is shown as the primary selector in new-vial flows.
- User can create a vial by selecting substance card -> formulation mini card -> submit.
- User can create a missing formulation from within the flow and continue without manual page hunting.
- Existing validation and success/error behaviors remain intact.
- Works in both `/inventory` and `/setup/inventory`.

## Testing Requirements
- Add/update browser coverage in `web/scripts/tbrowser/peptaide-e2e.mjs` for:
  - selecting formulation via card UI
  - invoking "Add formulation" from vial flow and completing vial creation
  - mobile viewport interaction sanity
- Keep diagnostics gate: no console errors, no page errors, no failed 4xx/5xx requests in covered flow.

## Out of Scope
- Cost derivation and order linkage logic changes (covered by separate PR).
- Full visual redesign of unrelated pages.
