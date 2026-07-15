# Builds apps/server (the deployable persona process — same image runs every persona,
# parameterized at runtime by MOE_PERSONA_ID / Slack credentials env vars; see docs/ARCHITECTURE.md
# "Process topology"). Multi-stage: install once, build once, ship a slim runtime image.

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/package.json
COPY packages/memory/package.json packages/memory/package.json
COPY packages/agents/package.json packages/agents/package.json
COPY packages/slack/package.json packages/slack/package.json
COPY packages/github/package.json packages/github/package.json
COPY apps/server/package.json apps/server/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server ./apps/server
WORKDIR /app/apps/server
EXPOSE 8080
CMD ["node", "dist/index.js"]
