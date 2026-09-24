# Trix image: the bundled server (no node_modules at runtime) plus the built web app.
# Built on the dev machine from a clean commit, never on the VPS (see docs/deploy.md):
#   git archive HEAD | docker build -f deploy/Dockerfile -t trix-web:<sha> -
# Base image checked 2026-09-24: node 24.21.0 (Active LTS) on Alpine 3.24.

FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY tools/station/package.json tools/station/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm run build

FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
WORKDIR /app
COPY --from=build /src/apps/server/dist/index.js server/index.js
COPY --from=build /src/apps/web/dist web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 WEB_DIST=/app/web
# Only reachable over the `edge` Docker network; never published on the host.
EXPOSE 8080
USER node
CMD ["node", "server/index.js"]
