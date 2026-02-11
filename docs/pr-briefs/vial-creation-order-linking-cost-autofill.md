# PR Brief: Link New Vials to Orders with Cost Autofill

## Goal
Enable users to select which order/order item a new vial is created from so vial cost and related metadata are auto-populated instead of manually entered.

## Problem to Solve
Today, vial creation is disconnected from specific order provenance. This causes avoidable manual entry and weakens confidence in cost attribution and spend analytics.

## UX Requirements
- In vial creation flows (`/inventory` and `/setup/inventory`), add an order linkage section after formulation selection.
- User can choose:
  - vendor -> order -> order item (or a flattened searchable "order item" selector)
- Once selected, auto-populate cost and recommended defaults from order item data.
- User can still override cost manually before submit.
- Show clear provenance preview (vendor, order date/id, item label, expected vials, implied per-vial cost).
- Preserve ability to create manual/unlinked vial when user intentionally skips linkage.

## Data and Logic Requirements
- Persist linkage to the relevant order entity (prefer order item-level linkage for precision).
- Reuse existing order price fields and vial generation semantics; do not create duplicate cost math paths.
- Define deterministic precedence:
  - linked item present -> use derived default cost
  - manual override present -> use override
  - no linkage -> current manual cost behavior

## Technical Notes
Likely file touchpoints:
- `web/src/app/(app)/(hub)/inventory/create-vial-form.tsx`
- `web/src/app/(app)/(hub)/inventory/actions.ts`
- `web/src/app/(app)/setup/inventory/page.tsx`
- `web/src/app/(app)/setup/actions.ts`
- related repos under `web/src/lib/repos/*` for order/order-item options
- consider schema update if vial linkage field is missing or too coarse

## Acceptance Criteria
- User can create a vial linked to a specific order item from UI.
- Cost is auto-populated from linked order item and visible before submit.
- Spend/runway analytics continue to function and use vial cost consistently.
- Manual unlinked vial creation still works.
- No regressions in existing generated-vial workflow on `/orders`.

## Testing Requirements
- Add browser coverage for linked and unlinked vial creation paths.
- Assert displayed cost defaults match selected order item math.
- Keep diagnostics gate: no console errors, no page errors, no failed 4xx/5xx requests in covered flow.

## Out of Scope
- Full redesign of orders UI (covered separately).
- Cross-account procurement models.
