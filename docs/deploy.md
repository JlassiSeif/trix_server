# Deploying Trix

**Where it runs:** `https://trix.rheona.space`, as a guest (the `trix` tenant) on the shared Rheona VPS `158.180.55.44`.

The rules for that machine come first. It runs fleet-critical services (the Docker registry and the license server) behind one Caddy that Trix doesn't own. They are in `deploy/new_tenant.md` (kept out of git) and the contract `rheonix-core/docs/ops/VPS_SHARED_HOSTING.md`. Re-read them before any change. If this page disagrees with them, they win.

## What runs

```
browser ──HTTPS/WSS──▶ rheona-infra-caddy-1 (owns :80/:443 and certificates)
                         └─ edge network ──▶ trix-web-1:8080 (our container, no host ports)
                                               └─ saves rooms to /home/ubuntu/trix/data/rooms.json
```

- **The image `trix-web`:** Node 24 on Alpine, the one-file server bundle and the built web app. No `node_modules`. It is built on the dev machine from a commit (`git archive HEAD`), never on the VPS.
- **The container:** capped at 128 MB and 1 CPU. It runs as uid 1001 (`ubuntu`, which owns the data folder), with a read-only filesystem, all capabilities dropped and no privilege escalation. It's reachable only over the `edge` network.
- **Memory measured 2026-09-24:** 18 MB idle, 34 MB peak with 50 tables playing at once at 20× speed.
- **Rooms are saved** 0.5 s after every change and again on shutdown, so a deploy puts every player back where they were. The file holds seat tokens: mode 600, inside our 700 folder.

## Our footprint on the VPS (nothing else is ours)

| Path | What |
|---|---|
| `/home/ubuntu/trix/docker-compose.yml` | copy of `deploy/compose.yml` |
| `/home/ubuntu/trix/data/rooms.json` | saved rooms |
| `~/rheona-infra/sites.d/trix.caddy` | copy of `deploy/trix.caddy` |
| images `trix-web:<sha>`, `:latest`, `:prev` | the current release and the one before |

## Settings (in `deploy/compose.yml`)

| Variable | Value | Meaning |
|---|---|---|
| `TRIX_STATE_FILE` | `/data/rooms.json` | where rooms are saved |
| `TRIX_TRUST_PROXY` | `private` | believe `X-Forwarded-For` from a private-network peer (Caddy on `edge`). Needed for the per-address limits; safe because no port is published. |
| `TRIX_ORIGINS` | `https://trix.rheona.space` | only our own page may open game connections |
| `NODE_OPTIONS` | `--max-old-space-size=80` | keeps the JS heap well inside the cap |
| `HOST`, `PORT`, `WEB_DIST` | `0.0.0.0`, `8080`, `/app/web` | set in the image |

`TRIX_SPEED` is for tests only. Never set it in production.

## Deploying

```bash
npm test && npm run typecheck     # green first
deploy/deploy.sh                  # needs ~/.ssh/rheona (or TRIX_SSH_KEY)
```

The script:
1. refuses a dirty working tree, a `ports:` in the compose file, or DNS not pointing at the VPS;
2. builds `trix-web:<sha>`, keeps a copy in `.deploy/`, and ships it with `docker load` (tagging the previous `latest` as `prev`);
3. copies the compose file and runs `docker compose up -d` in our folder only;
4. proves `trix-web-1` answers on `edge` before Caddy is involved;
5. installs the site file only if it changed: validate, then reload (never restart). If that fails, it removes our file again;
6. runs the post-checks and asserts each one on its own: registry 401, license 404, install.sh 200, Trix 200.

Games in progress survive a deploy: players see "Reconnecting…" for a moment, then carry on.

`deploy/deploy.sh --checks` runs only the post-checks.

## Backing out

- **A neighbour's post-check fails:** back out first, investigate after. Run `ssh ubuntu@158.180.55.44 'rm ~/rheona-infra/sites.d/trix.caddy'`, then validate and reload (as in the script), rerun the checks, and tell the owner.
- **The previous release:** `docker tag trix-web:prev trix-web:latest && cd ~/trix && docker compose up -d`.
- **Stop Trix:** `cd ~/trix && docker compose down` (no `-v`). Caddy then answers 502 and keeps the certificate.

## Watching it

- Logs: `docker logs -f trix-web-1` (JSON lines). Useful warnings: `ws.rateLimited`, `ws.tooManyFromAddress`, `room.tooManyFromAddress`, `join.lockedOut`.
- Counts, from inside the container only: `docker exec trix-web-1 node -e "fetch('http://127.0.0.1:8080/api/stats').then(r=>r.json()).then(console.log)"`.
- Memory: `docker stats --no-stream trix-web-1`.
- From a laptop: `npm run station -- --base https://trix.rheona.space --speed 1 --only S01` plays one gentle game against the live server. Never run the stress, flood or attack scenarios against production: they share a machine with the fleet.
