# The games hub image: the bundled server (no node_modules at runtime) plus the built web app.
# Built on the dev machine from a clean commit, never on the VPS (see docs/deploy.md):
#   git archive HEAD | docker build -f deploy/Dockerfile -t trix-web:<sha> -
# Base image checked 2026-09-24: node 24.21.0 (Active LTS) on Alpine 3.24.

FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY platform/sdk/package.json platform/sdk/
COPY platform/protocol/package.json platform/protocol/
COPY platform/ui/package.json platform/ui/
COPY platform/server/package.json platform/server/
COPY platform/web/package.json platform/web/
COPY games/trix/engine/package.json games/trix/engine/
COPY games/trix/ui/package.json games/trix/ui/
COPY games/trix/station/package.json games/trix/station/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY platform platform
COPY games games
RUN npm run build

FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
WORKDIR /app
COPY --from=build /src/platform/server/dist/index.js server/index.js
COPY --from=build /src/platform/web/dist web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 WEB_DIST=/app/web
# Only reachable over the `edge` Docker network; never published on the host.
EXPOSE 8080
USER node
CMD ["node", "server/index.js"]
