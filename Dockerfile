# ── Build ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime (hardened) ──────────────────────────────────────────────────
# Alleen de gebouwde site + de zero-dependency server; geen npm, geen
# node_modules. Draait als niet-root; bestandssysteem kan read-only
# (het logboek schrijft naar het /data-volume).
FROM node:22-alpine
RUN apk add --no-cache wget \
  && addgroup -g 10001 app \
  && adduser -D -u 10001 -G app app \
  && mkdir -p /data && chown app:app /data
WORKDIR /app
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app server ./server

USER app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
EXPOSE 8080
VOLUME /data

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server/server.js"]
