# Coverage Baseline

## Date

2026-02-12

## Commands

    npm run test:coverage
    COVERAGE_BASE_REF=HEAD~1 npm run test:coverage:diff

## Baseline Notes

- Initial baseline added with coverage tooling enablement.
- Threshold enforcement should be ratcheted in CI by risk tier.
- Diff-coverage threshold defaults to 95% and can be tuned via `COVERAGE_DIFF_THRESHOLD`.

## Snapshot

- Overall line coverage: `16.77%`
- Overall branch coverage: `13.53%`
- Diff coverage vs `HEAD~1`: `13.04%` (`changed=23`, `covered=3`)
- Gate status at default threshold (`95%`): failing, as expected before Tier A/B backfill work.

## Next Update Checklist

- Record current line/branch percentages for Tier A/B/C.
- Record mutation scores for Tier A and Tier B.
- Record PR-critical and nightly lane runtime medians.
