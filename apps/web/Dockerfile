# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
# npm lockfiles generated on another OS can omit Linux-only native packages.
# Install only the matching native packages at the already locked versions.
RUN npm ci \
    && ARCH="$(node -p 'process.arch')" \
    && NEXT_VERSION="$(node -p 'require("./node_modules/next/package.json").version')" \
    && LIGHTNINGCSS_VERSION="$(node -p 'require("./node_modules/lightningcss/package.json").version')" \
    && npm install --no-save --package-lock=false \
      "@next/swc-linux-${ARCH}-musl@${NEXT_VERSION}" \
      "lightningcss-linux-${ARCH}-musl@${LIGHTNINGCSS_VERSION}"

FROM dependencies AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY apps/web apps/web
COPY packages/shared packages/shared
RUN npm run build --workspace=@playable/shared && npm run build --workspace=web

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
