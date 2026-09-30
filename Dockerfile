# ── Build ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=$APP_VERSION
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime (hardened) ──────────────────────────────────────────────────
# Alleen de gebouwde site + de zero-dependency server; geen npm, geen
# node_modules. Draait als niet-root; bestandssysteem kan read-only (het
# scheepslogboek gaat via Signal, er wordt niets weggeschreven) - dus geen
# volume nodig. De serverstatus-widget meet vrije schijfruimte via statfs
# op de container-root zelf (zie server/host.js).
# Gebruikt de ingebouwde `node`-user (uid 1000) van het base-image i.p.v.
# zelf een user aan te maken; `wget` zit al standaard in Alpine (BusyBox).
FROM node:24-alpine
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server

USER node
ENV NODE_ENV=production \
    PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server/server.js"]
