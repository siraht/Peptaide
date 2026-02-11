# PR Brief: Redesign Cycles as Substance-Centered Insight Cards

## Goal
Replace the current cycle table-first presentation with clearer, more intuitive substance cards that surface cycle health and stats graphically.

## Problem to Solve
The existing cycle list is technically correct but visually dense and hard to interpret quickly. Users need immediate per-substance clarity: active/completed state, streak length, break status, recent activity, and risk/gap signals.

## UX Requirements
- Cycles landing page should render one card per substance as primary navigation.
- Each card should include compact visual summaries, for example:
  - active/completed badge
  - current cycle day count
  - break-to-next indicator
  - recent events count
  - total administered mg in cycle
- Use visual hierarchy and simple graphics (sparklines/rings/bars) to improve scanability.
- Card click opens detail panel/page with existing advanced actions (split/end/inspect).
- Empty states must clearly explain how cycles start and how to create first cycle.
- Mobile layout should stack cards cleanly without losing key stats.

## Technical Notes
Primary file targets:
- `web/src/app/(app)/(hub)/cycles/page.tsx`
- cycle UI components extracted under `web/src/components/` or local feature components
- supporting repos/views in `web/src/lib/repos/*` as needed for card metrics

Keep existing cycle mutation behaviors and server actions intact:
- `web/src/app/(app)/(hub)/cycles/actions.ts`
- `web/src/app/(app)/(hub)/cycles/[cycleInstanceId]/*`

## Acceptance Criteria
- `/cycles` is card-first (not plain table-first).
- User can understand per-substance status without opening details.
- Existing detail actions still reachable and functional.
- Visual quality is coherent with current Peptaide theme and responsive on mobile.

## Testing Requirements
- Add browser coverage for:
  - card rendering for multiple substances
  - navigation from card -> detail
  - one cycle action from detail still functioning
- Keep diagnostics gate: no console errors, no page errors, no failed 4xx/5xx requests in covered flow.

## Out of Scope
- Rewriting underlying cycle computation logic.
- Full analytics overhaul beyond cycle page and immediate cycle detail context.
