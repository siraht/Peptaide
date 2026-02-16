# Peptaide CLI

`peptaide` is an automation-friendly command-line client for the `web` API at `/api/cli/*`.

It is designed for agent workflows:
- stable JSON envelopes (`--json`)
- explicit mutation safety (`--apply`, dry-run default)
- deterministic idempotent retries (`--idempotency-key`)

## Install and Build

From repo root:

```bash
cd cli
npm install
npm run build
```

Run help:

```bash
node dist/index.js --help
```

## Global Flags

- `--json` machine envelope output.
- `--plain` line-stable output.
- `--api-url <url>` default `http://127.0.0.1:3002`.
- `--profile <name>` local credential profile (default `default`).
- `--timeout-ms <int>` request timeout.
- `--request-id <id>` trace id.
- `--no-input` disable prompts.
- `--quiet` / `--verbose`.

Config precedence:

`flags > env > .peptaide.json (project) > ~/.config/peptaide/config.json (user) > defaults`

Environment variables:

- `PEPTAIDE_API_URL`
- `PEPTAIDE_PROFILE`
- `PEPTAIDE_TIMEOUT_MS`
- `PEPTAIDE_AUTH_TOKEN`

## Output Envelope and Exit Codes

With `--json`, every command returns:

```json
{
  "ok": true,
  "code": "ok",
  "message": "Listed sessions.",
  "data": {},
  "warnings": [],
  "errors": [],
  "request_id": "..."
}
```

Exit codes:

- `0` success
- `1` runtime failure
- `2` validation/usage error
- `3` auth error
- `4` not found
- `5` conflict/idempotency conflict
- `6` timeout/network

## Auth Flow

Start OTP login:

```bash
node dist/index.js auth login --email you@example.com --json
```

Verify OTP and persist tokens in local profile store:

```bash
node dist/index.js auth verify --email you@example.com --code 123456 --json
```

Show active user:

```bash
node dist/index.js auth whoami --json
```

List local profiles:

```bash
node dist/index.js profiles --json
```

## Safety and Idempotency

Mutating commands default to dry-run unless `--apply` is passed.

Dry-run session create:

```bash
node dist/index.js sessions create \
  --formulation-id <uuid> \
  --input-text "0.2 mL" \
  --json
```

Destructive applies require `--force`:

- `auth token revoke --apply --force`
- `sessions delete --apply --force`
- `cycles rules delete --apply --force`
- `data delete-all --apply --force --confirm DELETE`

Apply session create with idempotency:

```bash
node dist/index.js sessions create \
  --formulation-id <uuid> \
  --input-text "0.2 mL" \
  --idempotency-key run-2026-02-16-001 \
  --apply \
  --json
```

## Calculation Examples

Parse free text:

```bash
node dist/index.js calc parse --text "0.3 mL" --json
```

Dose computation:

```bash
node dist/index.js calc dose \
  --input-text "0.3 mL" \
  --concentration-mg-per-ml 10 \
  --json
```

Effective-dose Monte Carlo:

```bash
node dist/index.js calc effective \
  --input-text "0.3 mL" \
  --concentration-mg-per-ml 10 \
  --formulation-id <uuid> \
  --mc-n 5000 \
  --mc-seed 42 \
  --json
```

## Session Lifecycle Examples

Create from text (dry-run):

```bash
node dist/index.js sessions create-from-text \
  --text "0.25mL" \
  --formulation-id <uuid> \
  --json
```

List recent sessions:

```bash
node dist/index.js sessions list --limit 20 --json
```

Get one session:

```bash
node dist/index.js sessions get --id <event-id> --json
```

Update notes/tags (apply):

```bash
node dist/index.js sessions update \
  --id <event-id> \
  --notes "Felt normal" \
  --tags "morning,checkin" \
  --apply \
  --json
```

Soft delete / restore:

```bash
node dist/index.js sessions delete --id <event-id> --apply --json
node dist/index.js sessions restore --id <event-id> --apply --json
```

Batch create from JSONL:

```bash
node dist/index.js sessions batch --jsonl ./sessions.jsonl --apply --json
```

## Cycle, Settings, Data

Cycle suggest:

```bash
node dist/index.js cycles suggest --substance-id <uuid> --new-event-ts 2026-02-16T12:00:00Z --json
```

Set cycle rules:

```bash
node dist/index.js cycles rules set \
  --substance-id <uuid> \
  --gap-days-to-suggest-new-cycle 10 \
  --auto-start-first-cycle true \
  --apply \
  --json
```

Update profile settings:

```bash
node dist/index.js settings profile set \
  --timezone America/New_York \
  --default-mass-unit mg \
  --default-volume-unit mL \
  --default-simulation-n 5000 \
  --cycle-gap-default-days 10 \
  --apply \
  --json
```

Export bundle:

```bash
node dist/index.js data export --out ./peptaide-export.zip --json
```

## Query and Catalog

Discover resources:

```bash
node dist/index.js query resources --json
```

Generic list with filters/sort:

```bash
node dist/index.js query list \
  --resource administration_events \
  --filter "substance_id=eq:<uuid>" \
  --sort "ts:desc" \
  --limit 25 \
  --json
```

Shortcuts:

```bash
node dist/index.js query substances --query sema --json
node dist/index.js query formulations --substance-id <uuid> --json
node dist/index.js query dose-history --from 2026-01-01T00:00:00Z --json
node dist/index.js query inventory-summary --json
node dist/index.js query active-vials --json
```

Catalog aliases:

```bash
node dist/index.js catalog substances list --query sema --json
node dist/index.js catalog vials list --status active --json
```
