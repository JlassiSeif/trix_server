# Security review (2026-09-23)

**Scope:** the Trix server and web app as they run in production: a container behind the shared Rheona Caddy at `https://trix.rheona.space`.

**What we protect:**
- fair games (nobody cheats, nobody sees another player's cards);
- the seats (nobody takes someone else's place);
- the server staying up for everyone;
- the machine itself.

**How it was checked:**
- the code review below;
- the testing station's attack scenarios (`npm run station -- --only X01,…,X10`), all passing;
- the security tests in `apps/server/test`;
- the browser tests in `apps/web/e2e/connections.mjs`;
- `npm audit`.

## Threats and protections

| Threat | Protection | Evidence |
|---|---|---|
| **Cheating:** playing out of turn, illegal cards, extra looks at the last trick, forged moves | The server decides everything: every move is checked by the rules engine against the real state, and the browser only sends requests | Station S10 (718 out-of-turn moves, none took effect), S13 (double clicks), S21 (look limit), the referee on every move, the mutation check (7/7) |
| **Seeing other players' cards** | Each player is only ever sent their own view; the full game state never leaves the server. A look at the last trick goes only to the player who asked. | Station privacy checks at every update of every run (0 leaks); S21; engine view tests |
| **Taking someone's seat** | Seat tokens are 128 random bits and only work at their own table. They're compared in constant time. 20 wrong tokens, links or room ids lock an address out for 10 minutes. | X04 (no seat stolen, guesser locked out), X09, S16, S20; server test "locks out an address" |
| **Getting into a table uninvited** | Invite codes are about 40 random bits on top of the room id; the same lockout applies; a leave or kick replaces the code | X03 (locked out even when it finally guessed right; friends unaffected), S16 |
| **Pretending to be another player** | No two people with the same name at a table, whatever the upper/lower case or spacing | X05; server test "no impersonation" |
| **Knocking the server over:** message floods | Each connection may send a burst of 80 messages, then 40 per second; over that, it's disconnected and logged once. Messages are limited to 4 KB, and compression is off (no decompression bombs). | S22 (server answered in 6 ms during a 20,000-message flood), S12, server test "cuts off a flooding connection" |
| **Using up connections or tables** | 20 connections and 5 open tables per address; 1000 connections and 200 tables in total | X01, X02; server tests |
| **Slow-request attacks** (slowloris) | Headers within 10 s, the whole request within 15 s, checked every 2 s (Caddy in front absorbs most of this anyway) | X08 (cut off after 11 s) |
| **Malicious input:** junk, `__proto__` tricks, deep nesting, wrong types | Every message is parsed defensively; unknown or badly-typed fields are refused; nothing from a message is merged into server objects | S11 (20 kinds of junk, sender stays seated), hub robustness tests |
| **Other websites using our server** (a visitor's browser opening game connections) | Game connections are only accepted from our own site (`TRIX_ORIGINS`). Seat tokens live in the page's own storage, not in cookies, so another site can't use them. | X06; server test "refuses game connections from other websites" |
| **Script injection** (XSS) through names | React writes names as text, never as HTML. There's no raw-HTML code anywhere, and a strict content policy allows only our own scripts. | Browser C13 (names with `<script>` and HTML shown literally); code scan |
| **Being shown inside another site** (clickjacking) | `frame-ancestors 'none'` and `X-Frame-Options: DENY` | X07 |
| **Reading files off the server** | Only files inside the built web app can be served; traversal tricks, broken encodings and NUL bytes are refused. Methods other than GET/HEAD get 405. | X07 (7 traversal variants, nothing served) |
| **Invite links leaking** to other sites | `Referrer-Policy: no-referrer`; the invite code is removed from the address bar once seated | X07 headers |
| **Server details leaking** | No software/version headers; the stats page only answers on the machine itself; errors never include internals | X07; server tests |
| **Secrets in logs** | Seat tokens and invite codes are never logged | X10 (every token and code from a whole run checked against the log: 0 found) |
| **Secrets at rest** | The saved-rooms file (which holds seat tokens) is written with permissions 600, in the service's own state folder | Server test (file mode 600) |
| **Vulnerable dependencies** | Only one outside library ships with the server (`ws`, bundled in); versions are pinned | `npm audit`: 0 known vulnerabilities |
| **The machine** (shared with the Rheona fleet) | Trix is a guest container: no host ports (only Caddy reaches it, over the `edge` network), 128 MB and 1 CPU cap, runs as uid 1001 with a read-only filesystem, all capabilities dropped, no privilege escalation. Caddy (not ours) handles HTTPS; our site file caps request bodies at 16 KB and removes the `Server` header. No HSTS, on the box rules' advice. | `deploy/compose.yml`, `deploy/trix.caddy`, `docs/deploy.md` |

## Accepted risks (reasonable for a friends' server)

- **Someone with a valid invite link can join.** The link is the key. If it's shared too widely, the owner can kick anyone, and kicking changes the link.
- **The owner has full control of their table** (kick, end the game). That's intended.
- **Look-alike names** ("Seif" and "Seyf") are allowed. Exact duplicates aren't.
- **A determined attacker with many addresses** could still use up the 200 tables or 1000 connections. For a small private server, that's handled by blocking addresses in our Caddy site file if it ever happens.
- **No accounts or passwords:** seats are tied to the browser. Clearing the browser's storage gives the seat up, and the owner re-invites.

## If something happens

- **Logs:** `docker logs trix-web-1`. Useful warnings: `ws.rateLimited`, `ws.tooManyFromAddress`, `room.tooManyFromAddress` and `join.lockedOut`, each with the address.
- **Blocking an address:** a `remote_ip` matcher in our own site file (`deploy/trix.caddy`); the firewall is not ours.
- **Ending everything:** `cd ~/trix && docker compose down`. Delete `~/trix/data/rooms.json` to drop all tables.
