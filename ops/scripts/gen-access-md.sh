#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ts_json="$(tailscale status --json)"
ts_dns="$(echo "$ts_json" | jq -r '.Self.DNSName' | sed 's/\.$//')"
ts_ip4="$(echo "$ts_json" | jq -r '.TailscaleIPs[]' | rg -m 1 '^[0-9]+\.' || true)"

web_port="${PEPTAIDE_WEB_PORT:-3002}"
web_https_port="${PEPTAIDE_WEB_TS_HTTPS_PORT:-13002}"

supabase_http_port="${PEPTAIDE_SUPABASE_HTTP_PORT:-54321}"
supabase_https_port="${PEPTAIDE_SUPABASE_TS_HTTPS_PORT:-15432}"

mailpit_http_port="${PEPTAIDE_MAILPIT_HTTP_PORT:-54324}"
mailpit_https_port="${PEPTAIDE_MAILPIT_TS_HTTPS_PORT:-15433}"

anon_key=""
if [[ -f "${REPO_ROOT}/web/.env.local" ]]; then
  anon_key="$(rg -n "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "${REPO_ROOT}/web/.env.local" | head -n 1 | cut -d= -f2- || true)"
fi
if [[ -z "${anon_key}" ]]; then
  anon_key="sb_publishable_REPLACE_ME"
fi

cat > "${REPO_ROOT}/ACCESS.md" <<EOF
# Access (VPS / tailnet)

This file is intentionally git-ignored. It is the "how do I reach the running services" cheat sheet for this VPS.

## Host Identity

- Tailscale DNS: \`${ts_dns}\`
- Tailscale IPv4: \`${ts_ip4:-unknown}\`

## Web App

Direct port (HTTP, tailnet only via \`ufw\`):

- http://${ts_dns}:${web_port}

Tailscale Serve (HTTPS, tailnet only):

- https://${ts_dns}:${web_https_port}

## Local Supabase (dev backend)

Direct ports (HTTP, tailnet only):

- API: http://${ts_dns}:${supabase_http_port}
- Studio: http://${ts_dns}:54323
- Mailpit: http://${ts_dns}:${mailpit_http_port}

Tailscale Serve (HTTPS, tailnet only):

- API: https://${ts_dns}:${supabase_https_port}
- Mailpit: https://${ts_dns}:${mailpit_https_port}

## Start/Stop (systemd)

Enable and start:

    sudo install -d /etc/peptaide
    sudo cp -f /data/projects/peptaide/ops/systemd/peptaide-web.service /etc/systemd/system/peptaide-web.service
    sudo cp -f /data/projects/peptaide/ops/systemd/peptaide-tailscale-serve.service /etc/systemd/system/peptaide-tailscale-serve.service
    sudo systemctl daemon-reload

Create / update the env file used by peptaide-web:

    sudo tee /etc/peptaide/web.env >/dev/null <<'ENV'
    # Web listens on a port for direct access (tailnet only, unless you add ufw rules)
    PORT=${web_port}
    HOST=0.0.0.0

    # Browser talks to Supabase over HTTPS (avoid mixed-content when web is served via https)
    NEXT_PUBLIC_SUPABASE_URL=https://${ts_dns}:${supabase_https_port}
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon_key}

    # Server can use the local Supabase URL directly (faster, no TLS)
    SUPABASE_INTERNAL_URL=http://127.0.0.1:54321
    ENV

Start services:

    sudo systemctl enable --now peptaide-tailscale-serve.service
    sudo systemctl enable --now peptaide-web.service

Tail logs:

    journalctl -u peptaide-web -f

Disable Tailscale Serve endpoints (if needed):

    sudo tailscale serve --https=${web_https_port} off
    sudo tailscale serve --https=${supabase_https_port} off
    sudo tailscale serve --https=${mailpit_https_port} off

## Firewall Notes

This VPS currently has \`ufw\` enabled with default \`deny (incoming)\` and a blanket allow on \`tailscale0\`.
That means ports bound to \`0.0.0.0\` (like 3002/54321/54324) are reachable from your tailnet but not the public internet.
EOF

echo "Wrote ${REPO_ROOT}/ACCESS.md"
