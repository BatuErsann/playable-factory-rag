# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --include=dev

FROM dependencies AS builder
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npm run build --workspace=@playable/shared && npm run build --workspace=api

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace=api --workspace=@playable/shared --include-workspace-root \
    && npm cache clean --force

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY apps/api/src/db/init.sql apps/api/src/db/init.sql
COPY corpus corpus

WORKDIR /app/apps/api
EXPOSE 4000

CMD ["node", "dist/server.js"]
