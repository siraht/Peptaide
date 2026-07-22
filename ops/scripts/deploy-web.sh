#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
WEB_DIR="$ROOT/web"
ENV_FILE=${PEPTAIDE_WEB_ENV_FILE:-/etc/peptaide/web.env}
RUNTIME_USER=${PEPTAIDE_WEB_RUNTIME_USER:-peptaide-web}
RUNTIME_GROUP=${PEPTAIDE_WEB_RUNTIME_GROUP:-peptaide-runtime}

if [[ ${EUID} -eq 0 ]]; then
  echo "Refusing to build as root; run this script as the development user." >&2
  exit 1
fi

if ! id "$RUNTIME_USER" >/dev/null 2>&1; then
  echo "Missing runtime account $RUNTIME_USER; install the systemd deployment first." >&2
  exit 1
fi

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Cannot read $ENV_FILE; verify its ACL or runtime-group membership." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$WEB_DIR"
/usr/bin/npm run build

sudo chgrp -R "$RUNTIME_GROUP" .next/cache
sudo chmod -R g+rwX,o-rwx .next/cache
sudo find .next/cache -type d -exec chmod g+s {} +

sudo systemctl restart peptaide-web.service
/usr/bin/npm run runtime:preflight -- \
  --base-url "http://127.0.0.1:${PORT:-3002}" \
  --timeout-ms 60000

echo "Peptaide web deployed; runtime user: $RUNTIME_USER"
