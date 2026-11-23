# API, background worker, migrations and admin CLI (same image, different command).
# Build stage bundles the server into dist/*.mjs; the runtime image carries no node_modules.
FROM node:24.22.2-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod=false --filter @gym/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @gym/api bundle

FROM node:24.22.2-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
WORKDIR /app
RUN addgroup -g 101 app && adduser -u 100 -G app -D -H app
COPY --from=build /app/apps/api/dist dist
COPY apps/api/drizzle drizzle
# The coach needs the catalog on the server (same file the PWA downloads).
COPY packages/catalog/out/catalog catalog
ENV NODE_ENV=production PORT=3000 MIGRATIONS_DIR=/app/drizzle CATALOG_DIR=/app/catalog
USER 100:101
EXPOSE 3000
# Other commands: node dist/worker.mjs · node dist/migrate.mjs · node dist/admin.mjs invite
CMD ["node", "dist/index.mjs"]
