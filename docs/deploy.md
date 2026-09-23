# Deploying Trix (draft)

**Status: draft, waiting for Seif's instructions.** Nothing here has been run on the Oracle machine yet. Placeholders are marked `<…>`.

## What runs in production

```
browser ──HTTPS/WSS──▶ Caddy (:443, automatic certificate) ──▶ node apps/server/dist/index.js (127.0.0.1:8080)
                                                                   └─ saves rooms to /var/lib/trix/rooms.json
```

- **One Node process.** `apps/server/dist/index.js` is a single self-contained file (it needs no `node_modules`). It serves the built web app from `apps/web/dist` and runs the game WebSocket on `/ws`.
- **Requirements:** Node **≥ 22.12**, on x86 or ARM. It uses about 60 MB of RAM when idle. In the stress test, 100 tables at once stayed well within a small VM (numbers in `docs/predeploy-check.md`).
- **Rooms are saved** to `TRIX_STATE_FILE` 0.5 s after every change, and again on shutdown. A restart or deploy puts every player back where they were. The file holds seat tokens, so it's created with permissions 600.

## Settings (environment variables)

| Variable | Production value | Meaning |
|---|---|---|
| `PORT` | `8080` | Port the server listens on |
| `HOST` | `127.0.0.1` | Listen only locally; Caddy is the public face |
| `TRIX_STATE_FILE` | `/var/lib/trix/rooms.json` | Where rooms are saved |
| `WEB_DIST` | `/opt/trix/apps/web/dist` | The built web app |
| `TRIX_LOG_LEVEL` | `info` | `debug` logs every move; `info` logs joins, pauses, scores and errors |
| `TRIX_MAX_ROOMS` | `200` (default) | Cap on tables |

`TRIX_SPEED` is for tests only. Never set it in production.

## Build (on the machine or before copying)

```bash
npm ci
npm run build       # → apps/web/dist and apps/server/dist/index.js
npm test            # engine + server tests
```

Only `apps/server/dist/index.js` and `apps/web/dist/` are needed to run.

## Install (draft, to be confirmed with Seif)

1. Create a user with no login: `sudo useradd --system --home /opt/trix --shell /usr/sbin/nologin trix`.
2. Put the repo (or just the two build outputs) in `/opt/trix`, owned by `trix`.
3. Install the service: copy `deploy/trix.service` to `/etc/systemd/system/`, check the `node` path (`which node`), then `sudo systemctl daemon-reload && sudo systemctl enable --now trix`.
4. Install Caddy, and put `deploy/Caddyfile` (with the real domain) in `/etc/caddy/Caddyfile`. Then `sudo systemctl reload caddy`.
5. DNS: an `A` record for `<domain>` pointing to the machine's public IP.
6. Open ports 80 and 443 in **both** places:
   - the Oracle VCN security list (ingress rules);
   - the machine's own firewall. Oracle's Ubuntu images block these by default in iptables.

## Check it works

- `curl -s http://127.0.0.1:8080/api/health` on the machine → `{"ok":true,...}`.
- `https://<domain>` in a browser: create a table, add 3 bots, play a card.
- `journalctl -u trix -f` shows the JSON log lines.
- From a laptop: `npm run station -- --base https://<domain> --only S01,S14` plays against the live server. Don't run the stress or flood scenarios against production.

## Updating later

```bash
cd /opt/trix && git pull && npm ci && npm run build && sudo systemctl restart trix
```

Games in progress survive this: players see "Reconnecting…" for a second or two, then carry on.

## What I need from Seif

1. The domain name (or subdomain) to use.
2. The Oracle machine: its shape (ARM A1 or AMD micro), OS and version, and how I get access (SSH user or key), or whether you'd rather run the commands yourself.
3. Whether Node is already installed there, and how you prefer to install it (distro package, NodeSource or nvm).
4. Whether anything else already runs on that machine on ports 80/443 (another web server).
