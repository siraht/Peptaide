# Harden the Peptaide development stack without disrupting development

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md`. This plan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, the Peptaide web application can continue to be built and deployed by the normal `ubuntu` development account, while inbound web requests execute as an unprivileged `peptaide-web` service account. The Supabase CLI development stack remains available through the trusted Tailscale network, but its Docker-published development ports are blocked on the public interface. Development-only analytics containers that mount the Docker socket are not started. The result is observable by checking the service identity, the Docker firewall guard, the Tailscale endpoints, and the application health endpoint.

This is deliberately a development-stack hardening change, not a conversion of `supabase start` into a production database. Supabase's CLI stack uses development defaults. Real company production data must eventually move to managed Supabase or the official production self-hosting Compose deployment.

## Progress

- [x] (2026-07-22 14:15Z) Audited the running containers, systemd units, public listeners, repository state, and current Supabase configuration.
- [x] (2026-07-22 14:20Z) Confirmed that unrelated application work is present in the working tree and must not be staged by this change.
- [x] (2026-07-22 14:13Z) Added the idempotent Docker firewall guard and its systemd unit.
- [x] (2026-07-22 14:15Z) Updated the Supabase unit to run its controller as `ubuntu`, omit Logflare/Vector, and require the firewall guard.
- [x] (2026-07-22 14:15Z) Updated the Peptaide web unit and deployment helper so builds remain owned by `ubuntu` while the server runs as `peptaide-web`.
- [x] (2026-07-22 14:15Z) Updated Tailscale URLs to use the existing HTTPS Serve endpoints.
- [x] (2026-07-22 14:14Z) Backed up the local schema and data before restarting the development stack.
- [x] (2026-07-22 14:15Z) Installed the service account, group, units, root-owned firewall helper, and restricted environment-file permissions.
- [x] (2026-07-22 14:17Z) Restarted and validated the firewall, Supabase, web, and Tailscale services.
- [x] (2026-07-22 14:26Z) Verified the web process runs as `peptaide-web`, the desired Tailscale URLs respond, and independent external probes time out on the public Supabase ports.
- [x] (2026-07-22 14:23Z) Ran type checking, 119 tests, shell syntax checks, systemd verification, runtime preflight, and service checks successfully.
- [ ] Commit only the hardening paths.
- [ ] Push the branch and open a draft pull request.

## Surprises & Discoveries

- Observation: The running stack is the Supabase CLI local-development environment, not the official self-hosted production Compose deployment.
  Evidence: every container has `com.supabase.cli.project=peptaide`, and the project is configured by `supabase/config.toml`.

- Observation: UFW does not currently mediate Docker-published Supabase ports because Docker's forwarding chains run before UFW's forwarding chains.
  Evidence: the `FORWARD` chain jumps to `DOCKER-USER` and `DOCKER-FORWARD` before the UFW chains, while `DOCKER-USER` is empty.

- Observation: the repository has extensive unrelated modified and untracked application work on `main`.
  Evidence: `git status -sb` listed application pages, repositories, migrations, plans, and `.agent` artifacts unrelated to runtime hardening.

- Observation: a root-owned Node.js 22 installation exists at `/usr/bin/node` and `/usr/bin/npm`.
  Evidence: `/usr/bin/node --version` returned `v22.23.1`, so the runtime no longer needs access to `ubuntu`'s NVM tree.

- Observation: the local PostgreSQL database has a collation version mismatch after an operating-system collation update.
  Evidence: both successful `supabase db dump` operations warned that the database was created with collation version 153.120 while the host provides 153.121. This requires a separately backed-up reindex/refresh maintenance operation; it did not prevent the dumps.

## Decision Log

- Decision: Keep the Supabase CLI stack as a private development dependency and do not represent it as production-ready.
  Rationale: The CLI stack contains development services and defaults. The immediate safe outcome is containment; production migration is a separate architecture milestone.
  Date/Author: 2026-07-22 / Codex

- Decision: Block the original public destination ports in Docker's `DOCKER-USER` chain rather than relying on UFW.
  Rationale: Docker-published packets reach `DOCKER-USER` before Docker accepts them, and matching the connection's original destination port works after destination NAT has translated the packet to a container port.
  Date/Author: 2026-07-22 / Codex

- Decision: Keep builds under `ubuntu` but run only the Next.js server under `peptaide-web`.
  Rationale: Developers retain normal ownership of the checkout and build artifacts, while a request-handler compromise no longer inherits passwordless sudo, Docker, or LXD membership.
  Date/Author: 2026-07-22 / Codex

- Decision: Exclude Logflare and Vector from `supabase start`.
  Rationale: They are unnecessary for the current development workflow, Logflare creates another published port, and Vector can access the Docker socket.
  Date/Author: 2026-07-22 / Codex

## Outcomes & Retrospective

The live Peptaide stack now has a public-interface Docker firewall guard for IPv4 and IPv6. Peptaide Web runs as `peptaide-web:peptaide-runtime`, binds only to `127.0.0.1:3002`, passes runtime preflight, and has a systemd exposure score of 4.0 (`OK`). The developer still builds from the normal checkout through `ops/scripts/deploy-web.sh`. Logflare and Vector are no longer running; the API, database, Studio, and Mailpit remain available locally/Tailscale while their raw public ports are dropped.

The database was not reset. Timestamped schema and data dumps were created outside Git with mode `0600` and SHA-256 checksums. TypeScript validation and all 119 tests passed. Independent TCP probes reached public port 443 and timed out on ports 54321-54324; port 54327 has no listener, is absent from Docker, and the firewall recorded dropped probes across the protected range.

## Context and Orientation

The repository root is `/data/projects/peptaide`. The Next.js application is in `web/`. The local Supabase configuration is `supabase/config.toml`. Machine service templates live in `ops/systemd/`, and operational scripts live in `ops/scripts/`.

The current web service runs from `/data/projects/peptaide/web` and reads machine-local variables from `/etc/peptaide/web.env`. Before this work it built and served as `ubuntu`, an administrator account with passwordless sudo and membership in the Docker and LXD groups. The target account, `peptaide-web`, is a system account with a non-login shell, no supplementary groups, and no home directory containing development credentials.

The Supabase CLI publishes its local API, database, Studio, Mailpit, and analytics ports through Docker. A Docker-published packet is forwarded through Docker's own firewall chains. `DOCKER-USER` is the supported administrator-controlled chain evaluated before Docker's accept rules. The firewall helper added by this plan places an idempotent drop rule there for connections arriving on the public interface whose original destination port is in `54321:54327`. Tailscale traffic and local connections do not arrive on that interface and remain available.

The firewall helper committed to the repository is only a source template. The installation step copies it to `/usr/local/sbin/peptaide-firewall-guard` as a root-owned, non-writable executable before systemd runs it as root. This avoids making a root service execute a script writable by the development account.

## Plan of Work

Add `ops/scripts/peptaide-firewall-guard`, an idempotent POSIX shell program with `apply`, `remove`, and `check` operations. It discovers the default public interface unless `PUBLIC_INTERFACE` is explicitly set. For IPv4 and IPv6 it checks for `DOCKER-USER`, then inserts a rule that drops TCP connections arriving on that public interface when the connection tracking record's original destination port is `54321:54327`. `remove` deletes only the exact rule owned by this script. `check` fails unless the rule is present.

Add `ops/systemd/peptaide-firewall.service`. It runs the root-owned installed helper after Docker starts and before the Supabase service. It remains active after applying the rule and verifies the rule during start.

Revise `ops/systemd/peptaide-supabase.service` so the CLI controller runs as `ubuntu`, with `HOME=/home/ubuntu`, and invokes `supabase start -x logflare,vector`. The unit requires `peptaide-firewall.service`. This does not make the CLI containers a production stack; it reduces exposed components and removes the Vector Docker-socket consumer.

Revise `ops/systemd/peptaide-web.service` to use `User=peptaide-web`, `Group=peptaide-web`, `/usr/bin` Node.js, and the prebuilt Next.js output. Remove the build-on-start command and the port-killing helper. Add systemd hardening that does not prevent the application from reading its checkout, contacting Supabase, or writing Next.js cache data. Add `ops/scripts/deploy-web.sh` for the `ubuntu` developer: it loads the machine environment, builds, grants the runtime account read access plus cache write access using filesystem ACLs, restarts the unit, and performs the existing runtime preflight.

Update `supabase/config.toml` so browser-visible URLs use the existing Tailscale HTTPS Serve endpoints instead of raw Tailscale IP HTTP endpoints. Keep localhost callbacks for local development.

Before restarting Supabase, dump its schema and data into a restricted directory outside the repository. Install the account, group, templates, and helper. Restrict `/etc/peptaide/web.env` to a group containing only `ubuntu` and `peptaide-web`; do not add the runtime account to `ubuntu`, `sudo`, `docker`, or `lxd`.

## Concrete Steps

All repository commands run from `/data/projects/peptaide`.

Inspect only this change before staging:

    git diff -- ops/scripts/peptaide-firewall-guard ops/scripts/deploy-web.sh ops/systemd/peptaide-firewall.service ops/systemd/peptaide-supabase.service ops/systemd/peptaide-web.service supabase/config.toml plan-runtime-hardening.md

Back up the local database without resetting it:

    install -d -m 0700 /data/backups/peptaide
    supabase db dump --local --file /data/backups/peptaide/<timestamp>-schema.sql
    supabase db dump --local --data-only --file /data/backups/peptaide/<timestamp>-data.sql

Install the hardening artifacts with root ownership:

    sudo install -o root -g root -m 0755 ops/scripts/peptaide-firewall-guard /usr/local/sbin/peptaide-firewall-guard
    sudo install -o root -g root -m 0644 ops/systemd/peptaide-firewall.service /etc/systemd/system/peptaide-firewall.service
    sudo install -o root -g root -m 0644 ops/systemd/peptaide-supabase.service /etc/systemd/system/peptaide-supabase.service
    sudo install -o root -g root -m 0644 ops/systemd/peptaide-web.service /etc/systemd/system/peptaide-web.service

The account and environment permissions are installed idempotently by checking for their existence before creation. The exact commands and resulting IDs will be recorded in `Artifacts and Notes` after execution.

## Validation and Acceptance

Run the firewall helper's check operation and expect both IPv4 and IPv6 rules to be reported present:

    sudo /usr/local/sbin/peptaide-firewall-guard check

Inspect the running web process and expect the account to be `peptaide-web`, not `ubuntu`:

    systemctl show peptaide-web.service -p User -p Group -p ActiveState
    ps -o user,group,args -p "$(systemctl show peptaide-web.service -p MainPID --value)"

Check that Logflare and Vector are absent and the required Supabase containers are healthy:

    docker ps --format '{{.Names}}' | sort
    supabase status

The names `supabase_analytics_peptaide` and `supabase_vector_peptaide` must be absent.

Run the application checks:

    cd /data/projects/peptaide/web
    npm run typecheck
    npm test
    npm run runtime:preflight -- --base-url http://127.0.0.1:3002 --timeout-ms 60000

The preflight must report success. The Tailscale URL `https://flywheel.tail3be29.ts.net:13002` must load the web application, `:15432` must reach the Supabase API gateway, and `:15433` must reach Mailpit. The public VPS ports `54321`, `54322`, `54323`, `54324`, and `54327` must not accept connections from outside the VPS.

## Idempotence and Recovery

The firewall helper checks for an exact rule before insertion and deletes only that exact rule. Account creation checks `getent passwd` and `getent group` first. `install` atomically replaces unit templates with reviewed files. Database dumps are timestamped and never overwritten.

If the web service fails after the identity change, restore the previous unit template from the security backup, run `sudo systemctl daemon-reload`, and restart the service. The database is not reset or destroyed by this plan. If excluding Logflare or Vector causes an unexpected CLI dependency failure, restore the previous Supabase unit and restart it; the Docker volume remains intact.

If the firewall guard disrupts a required path, run:

    sudo /usr/local/sbin/peptaide-firewall-guard remove

This removes only the Peptaide public-interface rules and does not alter SSH, UFW, Tailscale, or the public reverse proxy.

## Artifacts and Notes

No secrets, database dumps, generated environment files, or machine backups belong in Git. The intended commit paths are limited to the files named in the `git diff` command above.

Validation transcript summary:

    web process: peptaide-web:peptaide-runtime
    systemd exposure: 4.0 OK
    Peptaide services: active
    Tailscale web: 307 redirect
    Tailscale API: 404 gateway response
    Tailscale Mailpit: 200
    typecheck: passed
    tests: 24 files, 119 tests passed
    runtime preflight: PASS
    protected-port firewall counter after external probing: 49 packets dropped

## Interfaces and Dependencies

The firewall helper depends on `ip`, `iptables`, `ip6tables`, and the Docker-managed `DOCKER-USER` chain. The web deployment helper depends on `/usr/bin/node`, `/usr/bin/npm`, `setfacl`, systemd, and the existing `web/scripts/runtime-preflight.mjs`. The service account must have no membership in `sudo`, `docker`, or `lxd`. Supabase remains managed by `/home/ubuntu/.local/bin/supabase` and Docker.

Plan revision note (2026-07-22): Initial plan created after the security audit. It chooses public-interface containment, a build/runtime identity split, and removal of development analytics components to preserve the existing local workflow while reducing exposure.

Plan revision note (2026-07-22): Updated after live deployment. The database backup, runtime identity, firewall guard, Tailscale endpoints, reduced container set, application tests, and external probe evidence all passed. The PostgreSQL collation warning remains a documented maintenance item for the Ubuntu upgrade window.
