# API and background worker (same image, different command). Runs TypeScript with tsx.
FROM node:24.22.2-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
WORKDIR /app
RUN corepack enable && addgroup -g 101 app && adduser -u 100 -G app -D -H app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod=false --filter @gym/api... && pnpm store prune
COPY packages/shared packages/shared
COPY apps/api apps/api
ENV NODE_ENV=production PORT=3000
USER 100:101
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "--import", "tsx", "src/index.ts"]
