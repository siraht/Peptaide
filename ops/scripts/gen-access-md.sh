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
    sudo cp -f /data/projects/peptaide/ops/systemd/peptaide-supabase.service /etc/systemd/system/peptaide-supabase.service
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

    # Server can use the local Supabase URL directly (faster, no TLS).
    # IMPORTANT: keep the same hostname as NEXT_PUBLIC_SUPABASE_URL so Supabase SSR cookie names
    # match and PKCE exchanges (magic links) work.
    SUPABASE_INTERNAL_URL=http://${ts_dns}:${supabase_http_port}
    ENV

Start services:

    sudo systemctl enable --now peptaide-supabase.service
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

## Future: Nginx Proxy Manager (public hosting)

When you add Nginx Proxy Manager (NPM) later, proxy to the web app on \`http://127.0.0.1:${web_port}\` (or to the host IP).
If you run NPM in Docker on Linux, the simplest option is \`network_mode: host\` so it can reach \`127.0.0.1\` on the VPS.
Avoid using Tailscale Serve on ports 80/443 if NPM is binding those ports.

## Browser Troubleshooting (Zen / Firefox DoH)

Symptom:

- You can open the app via the tailnet IP (for example \`http://${ts_ip4:-100.x.y.z}:${web_port}/sign-in\`) and \`tailscale ping ${ts_dns}\` works,
  but \`https://${ts_dns}:${web_https_port}\` does not load in Zen (or the app loads but cannot send a magic link / OTP email).

Root cause:

- \`${ts_dns}\` is a MagicDNS name. It normally resolves using Tailscale's DNS (\`100.100.100.100\`, via your OS resolver).
- If Zen has DNS-over-HTTPS ("Secure DNS") enabled, it may bypass your OS/Tailscale DNS and query a public resolver.
  Public resolvers do not know your tailnet's MagicDNS records, so \`${ts_dns}\` fails to resolve in that browser.
- If \`${ts_dns}\` can't resolve, the app also can't reach Supabase at \`https://${ts_dns}:${supabase_https_port}\`, so clicking
  "Send sign-in link" fails (check DevTools -> Network; you'll usually see DNS / connection errors to \`/auth/v1/otp\`).

Fix (Zen / Firefox-style settings):

1. Disable DNS-over-HTTPS / Secure DNS, or set it to "use system DNS" (recommended).
2. If you want to keep DoH enabled, add exclusions for \`ts.net\` and \`${ts_dns#*.}\`.
3. Clear the browser DNS cache (Firefox: \`about:networking#dns\` -> "Clear DNS Cache") and reload.
4. Ensure Zen isn't using a proxy/VPN profile that blocks nonstandard HTTPS ports (\`${web_https_port}/${supabase_https_port}/${mailpit_https_port}\`).
EOF

echo "Wrote ${REPO_ROOT}/ACCESS.md"
