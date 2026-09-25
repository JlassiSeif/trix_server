# Tunisian games hub

Dineri, Seif's hub for Tunisian card and table games, live at https://dineri.world (trix.rheona.space redirects there). Trix is the first game.

- **At the start of every session, load the `hub-session` skill** and follow its routine: TODOs, disk, the live site, leftover processes. It holds the working agreement with Seif (never invent rules; specs approved before code) and the traps already paid for.
- **Before any deploy, rollback, game switch-off or server change, load the `hub-deploy` skill.** The site shares a machine with fleet-critical services, and every deploy needs Seif's go for that change. A hook asks for confirmation whenever `deploy/deploy.sh` runs for real.
- The TODO lists are the plan: root `TODO.md` (platform, games index, roadmap) and `games/<game>/TODO.md`.
