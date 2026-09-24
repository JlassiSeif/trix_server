#!/usr/bin/env bash
# Deploy the current commit to the shared Rheona VPS as the `trix` tenant.
# Rules: deploy/new_tenant.md (kept out of git) and rheonix-core docs/ops/VPS_SHARED_HOSTING.md.
#
#   deploy/deploy.sh            build, ship, start, prove on edge, site file (only if changed), post-checks
#   deploy/deploy.sh --checks   post-checks only
#
# Every step stops the script on failure (set -e), and each post-check is asserted on its own.
set -euo pipefail

HOST=ubuntu@158.180.55.44
KEY=${TRIX_SSH_KEY:-$HOME/.ssh/rheona}
SITE=trix.rheona.space
APP_DIR=/home/ubuntu/trix
ssh_() { ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST" "$@"; }
scp_() { scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$@"; }
cd "$(git rev-parse --show-toplevel)"

check() { # name url want
  local got
  got=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$2" || echo "000")
  if [ "$got" = "$3" ]; then echo "  ok    $1 $got"; else echo "  FAIL  $1 $got (want $3)"; return 1; fi
}
postchecks() {
  echo "Post-checks (the neighbours' lines matter most):"
  local bad=0
  check registry   https://registry.rheona.space/v2/          401 || bad=1
  check license    https://license.rheona.space/              404 || bad=1
  check install.sh https://license.rheona.space/install.sh    200 || bad=1
  check trix       "https://$SITE/"                           200 || bad=1
  check trix-api   "https://$SITE/api/health"                 200 || bad=1
  if [ $bad = 1 ]; then
    echo "A post-check failed. If a NEIGHBOUR line failed: back out now (see docs/deploy.md) and tell the owner."
    exit 1
  fi
}
if [ "${1:-}" = "--checks" ]; then postchecks; exit 0; fi

# 1. One commit, not a snapshot.
if [ -n "$(git status --porcelain)" ]; then echo "Working tree not clean (untracked files count). Commit first."; exit 1; fi
SHA=$(git rev-parse --short HEAD)
grep -q "^ *ports:" deploy/compose.yml && { echo "deploy/compose.yml has a ports: section. Never."; exit 1; }
[ "$(dig +short A "$SITE")" = "158.180.55.44" ] || { echo "DNS for $SITE does not point at the VPS."; exit 1; }

# 2. Build here from the commit itself, ship the image; the VPS never builds.
echo "Building trix-web:$SHA"
git archive HEAD | docker build -q --label "trix.commit=$SHA" -f deploy/Dockerfile -t "trix-web:$SHA" - >/dev/null
mkdir -p .deploy && docker save "trix-web:$SHA" | gzip > ".deploy/trix-web-$SHA.tar.gz" # off-box copy of what shipped
echo "Shipping ($(du -h ".deploy/trix-web-$SHA.tar.gz" | cut -f1))"
ssh_ 'gzip -d | docker load -q' < ".deploy/trix-web-$SHA.tar.gz"
ssh_ "docker image inspect trix-web:latest >/dev/null 2>&1 && docker tag trix-web:latest trix-web:prev; docker tag trix-web:$SHA trix-web:latest"

# 3. Our folder and compose file; start (or recreate) our container only.
ssh_ "install -d -m 700 $APP_DIR $APP_DIR/data"
scp_ -q deploy/compose.yml "$HOST:$APP_DIR/docker-compose.yml"
ssh_ "cd $APP_DIR && docker compose up -d --quiet-pull 2>&1 | tail -3"

# 4. Prove it on edge before Caddy is involved.
for i in $(seq 1 20); do
  code=$(ssh_ 'docker run --rm --network edge curlimages/curl -s -o /dev/null -w "%{http_code}" http://trix-web-1:8080/api/health' || true)
  [ "$code" = "200" ] && break
  sleep 2
done
[ "$code" = "200" ] || { echo "trix-web-1 not answering on edge (got $code). Caddy untouched. Logs: docker logs trix-web-1"; exit 1; }
echo "trix-web-1 answers on edge: 200"

# 5. Site file: only when it changed. Validate, then reload; never restart.
if ! ssh_ "cat ~/rheona-infra/sites.d/trix.caddy 2>/dev/null" | cmp -s - deploy/trix.caddy; then
  echo "Installing the site file"
  scp_ -q deploy/trix.caddy "$HOST:rheona-infra/sites.d/trix.caddy"
  ssh_ 'docker exec rheona-infra-caddy-1 caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 && docker exec rheona-infra-caddy-1 caddy reload --config /etc/caddy/Caddyfile' \
    || { echo "Caddy validate/reload failed: removing our site file."; ssh_ 'rm -f ~/rheona-infra/sites.d/trix.caddy'; exit 1; }
  echo "Caddy reloaded; waiting for the certificate"
  for i in $(seq 1 30); do curl -s -o /dev/null --max-time 5 "https://$SITE/api/health" && break; sleep 3; done
fi

# 6. Post-checks, every deploy.
postchecks
echo "Deployed trix-web:$SHA"
