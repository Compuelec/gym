# Builds the PWA and serves it with Caddy (non-root).
FROM node:24.22.2-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @gym/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @gym/web build

FROM caddy:2.11.7-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
# Exercise catalog (run `pnpm catalog:build` before building the image).
COPY packages/catalog/out/catalog /srv/catalog
COPY packages/catalog/out/media /srv/media
ENV PORT=8080
USER 1000:1000
EXPOSE 8080
