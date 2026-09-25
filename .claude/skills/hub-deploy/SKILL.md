---
name: hub-deploy
description: Mandatory for ANY deploy, rollback, game switch-off, or change on the server of Dineri, the Tunisian games hub (dineri.world; formerly trix.rheona.space; the `trix` tenant on the shared Rheona VPS). Load it before running deploy/deploy.sh (other than --checks), before any ssh to the VPS that changes something, and before touching deploy/. It holds the shared server's hard rules, the gate before a deploy, the procedure, the live checks after, and how to back out.
---

# Deploying Dineri, the games hub

**We develop locally; Seif decides when to deploy, usually at a milestone** (Seif, 2026-09-25). Finished work is committed and pushed to GitHub, then waits. Never deploy, or push toward a deploy, because a change is done.

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
1. **Seif said "deploy" for this change, in this conversation.** Earlier approvals don't count, and a finished feature isn't a reason to ask.
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
4. **The neighbours are healthy before we start:** `deploy/deploy.sh --checks`. If a neighbour line already fails, don't deploy; tell Seif. (Our own lines may fail before the first deploy of a new address: exit code 2.)
5. **Saved games still load:** if a game's state or the room save format changed, a test must restore a save from the previous version (see the room tests for pre-hub saves).

## 3. Deploy
```bash
deploy/deploy.sh
```
It refuses a dirty tree, a `ports:` line or wrong DNS. It builds `trix-web:<sha>` from `git archive HEAD` and keeps a copy in `.deploy/`. It ships the image with `docker load`, tagging the previous `latest` as `prev`, copies `deploy/compose.yml` and starts our container only. It proves `trix-web-1` answers on `edge` before Caddy is involved, installs the site file only if it changed (validate, then reload; if Caddy rejects it, the previous file goes back), and asserts each post-check on its own: the neighbours (registry 401, license 404, install.sh 200), then ours (hub 200, hub API 200, www.dineri.world and trix.rheona.space 301).

Games in progress survive: rooms are saved and restored, and players see "Reconnecting…" for a moment.

## 4. After every deploy
1. **Live check in a real browser** against https://dineri.world (before the switch-over: https://trix.rheona.space): open the hub, open a game page, play a few moves against bots (a small Playwright script in `platform/web/e2e/`, deleted afterwards), and make sure there are no page errors. Leave the table afterwards.
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

## 6. The address: dineri.world (Seif, 2026-09-25)
The hub is **Dineri** at **https://dineri.world**. `www.dineri.world` and `trix.rheona.space` redirect to it, keeping the path, so old invite links still work. `deploy/trix.caddy`, `deploy/compose.yml` (`TRIX_ORIGINS`) and `deploy/deploy.sh` (`SITE`, `REDIRECTS`) are set for it.

**DNS at Namecheap** (Domain List → dineri.world → Advanced DNS). The nameservers stay Namecheap's (`dns1/dns2.registrar-servers.com`).
| Type | Host | Value |
|---|---|---|
| A record | `@` | `158.180.55.44` |
| CNAME record | `www` | `dineri.world.` |
Delete Namecheap's parking records (the URL redirect on `@` and the `www` → `parkingpage.namecheap.com` CNAME). **No AAAA record:** the VPS has no IPv6, and a wrong AAAA breaks certificates. deploy.sh refuses to run until all three names resolve to the VPS.

**The switch-over** (the first deploy with these files; only when Seif says deploy):
1. DNS resolves for all three names (`dig +short A dineri.world`, and the same for `www.dineri.world`).
2. Pick a quiet moment: browsers keep seats and names per address, so a table in progress on trix.rheona.space loses its players' saved seats. Look at the tables in play first: `docker exec trix-web-1 node -e "fetch('http://127.0.0.1:8080/api/stats').then(r=>r.json()).then(console.log)"`.
3. `deploy/deploy.sh`: Caddy gets certificates for all three names on the reload. Post-checks: hub 200, hub API 200, both redirects 301.
4. Tell Seif to share https://dineri.world from now on.

This puts a non-rheona.space domain on the fleet's Caddy. The Rheona contract only foresees `<app>.rheona.space`; **Seif approved it as the owner of both (2026-09-25).** DNS set by Seif the same day and verified: both names resolve to 158.180.55.44 at Namecheap's nameservers and public resolvers, with no AAAA record.

## 7. Facts
Address https://dineri.world (until the switch-over: https://trix.rheona.space). Container `trix-web-1`, network `edge`, data `/home/ubuntu/trix/data/rooms.json` (mode 600, folder 700, uid 1001). Image: Node 24 Alpine, pinned by digest in `deploy/Dockerfile`. Settings are in `deploy/compose.yml` (`TRIX_TRUST_PROXY=private` behind Caddy, `TRIX_ORIGINS`, `TRIX_CLOSED_GAMES`, the heap limit). Deploy history is in the TODO's "Deployed" entries; the full procedure for humans is in `docs/deploy.md`.
