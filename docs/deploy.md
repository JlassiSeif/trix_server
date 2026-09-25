# Deploying the games hub

**Where it runs:** Dineri's address is `https://dineri.world` (Seif, 2026-09-25); `www.dineri.world` and the old `https://trix.rheona.space` redirect to it. Until the switch-over deploy, the live site is still `https://trix.rheona.space`. It runs as a guest (the `trix` tenant) on the shared Rheona VPS `158.180.55.44`.

**When:** we develop locally; Seif decides when to deploy, usually at a milestone.

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
| `TRIX_CLOSED_GAMES` | empty | games switched off: no new tables, running ones finish (see "One game at a time") |
| `NODE_OPTIONS` | `--max-old-space-size=80` | keeps the JS heap well inside the cap |
| `HOST`, `PORT`, `WEB_DIST` | `0.0.0.0`, `8080`, `/app/web` | set in the image |

`TRIX_SPEED` is for tests only. Never set it in production.

## The domain (dineri.world, Namecheap)

In Namecheap's Advanced DNS for dineri.world: an **A record** for `@` → `158.180.55.44` and a **CNAME** for `www` → `dineri.world.`. Delete the parking records. No AAAA record (the VPS has no IPv6). The first deploy after that is the switch-over: pick a quiet moment, because players' saved seats don't carry across addresses. The steps are in the hub-deploy skill (§6).

## Before every deploy

For Claude, this is the `hub-deploy` skill (`.claude/skills/hub-deploy`); a hook asks for confirmation whenever `deploy/deploy.sh` runs for real.

1. Seif said "deploy" for this change. Earlier approvals don't count.
2. The change is committed and the tree is clean.
3. The full regression passed on this commit: unit tests, typecheck and build, the station, the mutation check, the arena, the browser flows, and a full game at desktop and phone size.
4. The neighbours are healthy before we start: `deploy/deploy.sh --checks`.
5. If a game's state or the save format changed, a test restores a save from the previous version.

## Deploying

```bash
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

## After every deploy

1. A real browser plays a few moves on the live site, with no page errors.
2. The server log shows the rooms restored and no bot or error lines; the container is healthy, has no published port, and stays well under its memory cap.
3. Record it: a "Deployed" entry in the TODO (date, image, what went live, how it was checked); the game's CHANGELOG and version; tags `<game>@<version>` and `platform@<version>`, pushed.
4. Tell Seif what went live.

## Backing out

- **A neighbour's post-check fails:** back out first, investigate after. Run `ssh ubuntu@158.180.55.44 'rm ~/rheona-infra/sites.d/trix.caddy'`, then validate and reload (as in the script), rerun the checks, and tell the owner.
- **The previous release:** `docker tag trix-web:prev trix-web:latest && cd ~/trix && docker compose up -d`.
- **Stop Trix:** `cd ~/trix && docker compose down` (no `-v`). Caddy then answers 502 and keeps the certificate.

## One game at a time

Every game has its own folder, version, changelog and tags (`docs/architecture.md` §3, §12).

- **Switch a game off** (a bad bug, no time to fix): add its id to `TRIX_CLOSED_GAMES` in `~/trix/docker-compose.yml` (e.g. `TRIX_CLOSED_GAMES: trix`), then `docker compose up -d`. No new tables for that game; tables already playing finish; every other game carries on. The home page shows it as "back in a moment". Remove the id to reopen.
- **Roll back one game:** restore its folder from its last good tag and deploy. Other games don't move.
  ```bash
  git checkout trix@1.0.0 -- games/trix        # the folder as it was at that release
  git commit -m "Roll Trix back to 1.0.0"
  deploy/deploy.sh
  ```
  This works as long as the game still fits the platform's contract (`platform/sdk`); the tests say so before the deploy.
- **Roll back everything:** the previous image, as above (`trix-web:prev`).

## Watching it

- Logs: `docker logs -f trix-web-1` (JSON lines). Useful warnings: `ws.rateLimited`, `ws.tooManyFromAddress`, `room.tooManyFromAddress`, `join.lockedOut`.
- Counts, from inside the container only: `docker exec trix-web-1 node -e "fetch('http://127.0.0.1:8080/api/stats').then(r=>r.json()).then(console.log)"`.
- Memory: `docker stats --no-stream trix-web-1`.
- From a laptop: `npm run station -- --base https://trix.rheona.space --speed 1 --only S01` plays one gentle game against the live server. Never run the stress, flood or attack scenarios against production: they share a machine with the fleet.
