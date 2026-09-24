---
name: hub-deploy
description: Mandatory for ANY deploy, rollback, game switch-off, or change on the server of the Tunisian games hub (trix.rheona.space, the `trix` tenant on the shared Rheona VPS). Load it before running deploy/deploy.sh (other than --checks), before any ssh to the VPS that changes something, and before touching deploy/. It holds the shared server's hard rules, the gate before a deploy, the procedure, the live checks after, and how to back out.
---

# Deploying the games hub

The site runs as a **guest container on a shared machine** whose real job is fleet-critical Rheonix infrastructure: the Docker registry and the license server that customer devices depend on. **Breaking a neighbour is the one unacceptable outcome;** it outranks shipping anything. When in doubt, stop and ask Seif.

Read before any change, every time: `deploy/new_tenant.md` (the box owner's rules, git-excluded) and `/home/seif/rheona/rheonix/rheonix-core/docs/ops/VPS_SHARED_HOSTING.md` (the contract). Where they disagree with this skill, they win; a mismatch with what's on the box means stop and ask.

## 1. Hard rules on the shared VPS (158.180.55.44, user ubuntu, key ~/.ssh/rheona)
- **Our footprint is exactly** `/home/ubuntu/trix/` (compose file, `data/rooms.json`) and `~/rheona-infra/sites.d/trix.caddy`, plus our images `trix-web:<sha>`, `:latest` and `:prev`. Nothing else on the machine is ours.
- **No `ports:` in the compose file, ever.** Caddy reaches us as `trix-web-1:8080` over the external `edge` network; join it, never create or remove it.
- **Never edit** `~/rheona-infra/Caddyfile`, its `docker-compose.yml`, `secrets/` or `auth/`. **Never run** `docker system prune`, `docker volume rm`, `docker network rm edge`, apt or docker upgrades, reboots, or firewall changes.
- **`caddy validate` then `caddy reload`, never `restart`.** Never write a Caddy file over ssh with a heredoc: edit `deploy/trix.caddy` locally and copy it (deploy.sh does this).
- **Never build on the box:** images are built here and shipped (the box has about 1 GB of RAM shared with the fleet). Our cap: 128 MB, 1 CPU. Measured: about 18–45 MB in use.
- **Anything outside these rules is a conversation with Seif** (and the box's owner), not a judgement call.

## 2. The gate before every deploy
1. **Seif said "deploy" for this change, in this conversation.** Earlier approvals don't count.
2. **A clean tree on a committed change:** `git status --porcelain` is empty (deploy.sh refuses otherwise).
3. **The full regression passed on this commit,** in one background run:
   ```bash
   npm test && npm run typecheck && npm run build
   npx tsx games/trix/station/src/main.ts                 # every scenario refereed
   npx tsx games/trix/station/src/mutants.ts              # every deliberate bug caught
   npm run arena -- --only A,B --games 200                 # bots still rank (full arena when bots changed)
   node platform/web/e2e/connections.mjs                   # browser flows
   # a full game at desktop and phone size against a local server (TRIX_SPEED=10, PORT=8123):
   node platform/web/e2e/play-vs-bots.mjs OUT && node platform/web/e2e/play-vs-bots.mjs OUT --viewport 390x844
   ```
   Then check that no test server was left running.
4. **The neighbours are healthy before we start:** `deploy/deploy.sh --checks`. If a neighbour line already fails, don't deploy; tell Seif.
5. **Saved games still load:** if a game's state or the room save format changed, a test must restore a save from the previous version (see the room tests for pre-hub saves).

## 3. Deploy
```bash
deploy/deploy.sh
```
It refuses a dirty tree, a `ports:` line or wrong DNS. It builds `trix-web:<sha>` from `git archive HEAD` and keeps a copy in `.deploy/`. It ships the image with `docker load`, tagging the previous `latest` as `prev`, copies `deploy/compose.yml` and starts our container only. It proves `trix-web-1` answers on `edge` before Caddy is involved, installs the site file only if it changed (validate, then reload; if that fails it removes our file again), and asserts each post-check on its own: registry 401, license 404, install.sh 200, Trix 200, Trix API 200.

Games in progress survive: rooms are saved and restored, and players see "Reconnecting…" for a moment.

## 4. After every deploy
1. **Live check in a real browser** against https://trix.rheona.space: open the hub, open a game page, play a few moves against bots (a small Playwright script in `platform/web/e2e/`, deleted afterwards), and make sure there are no page errors. Leave the table afterwards.
2. **The server's view:**
   ```bash
   ssh -i ~/.ssh/rheona -o IdentitiesOnly=yes ubuntu@158.180.55.44 'docker logs trix-web-1 2>&1 | grep -E "state.restored|server.listening|bot.crashed|bot.illegalMove|\"level\":\"error\"" | tail; docker stats --no-stream --format "{{.Name}} {{.MemUsage}}" trix-web-1; docker inspect trix-web-1 --format "{{.State.Health.Status}} {{json .NetworkSettings.Ports}}"'
   ```
   Want: rooms restored, no bot or error lines, healthy, `{"8080/tcp":null}` (no published port), memory well under 128 MB.
3. **Record it:**
   - a "Deployed" entry in the TODO: date, image sha, what went live, what was verified;
   - the game's CHANGELOG and version, if a game changed;
   - tag the release (`<game>@<version>`, `platform@<version>`) and push the tags.
4. **Tell Seif** what went live and how it was checked.

## 5. Backing out
- **A neighbour's post-check fails:** back out first, investigate after. Remove our site file, validate, reload, rerun `deploy/deploy.sh --checks`, and tell Seif at once.
  ```bash
  ssh -i ~/.ssh/rheona -o IdentitiesOnly=yes ubuntu@158.180.55.44 'rm ~/rheona-infra/sites.d/trix.caddy && docker exec rheona-infra-caddy-1 caddy validate --config /etc/caddy/Caddyfile && docker exec rheona-infra-caddy-1 caddy reload --config /etc/caddy/Caddyfile'
  ```
- **The whole release:** `docker tag trix-web:prev trix-web:latest && cd ~/trix && docker compose up -d` on the box.
- **One game:** restore its folder from its last good tag (`git checkout trix@1.0.0 -- games/trix`), commit, run the gate, deploy.
- **Switch a game off** (no new tables; running ones finish; other games unaffected): set `TRIX_CLOSED_GAMES: <id>` in `deploy/compose.yml`, commit, deploy. In an emergency, edit `~/trix/docker-compose.yml` on the box and `docker compose up -d`. Put the same change in the repo, because the next deploy overwrites the box's copy.
- **Stop the site:** `cd ~/trix && docker compose down` (never `-v`). Caddy answers 502 and keeps the certificate.

## 6. Facts
Live URL https://trix.rheona.space. Container `trix-web-1`, network `edge`, data `/home/ubuntu/trix/data/rooms.json` (mode 600, folder 700, uid 1001). Image: Node 24 Alpine, pinned by digest in `deploy/Dockerfile`. Settings are in `deploy/compose.yml` (`TRIX_TRUST_PROXY=private` behind Caddy, `TRIX_ORIGINS`, `TRIX_CLOSED_GAMES`, the heap limit). Deploy history is in the TODO's "Deployed" entries; the full procedure for humans is in `docs/deploy.md`.
