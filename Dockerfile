# syntax=docker/dockerfile:1
# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN npm ci --ignore-scripts

# Copy source
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Build shared first, then server
RUN npm run build --workspace=packages/shared && \
    npm run build --workspace=packages/server

# ─── Stage 2: Runtime (distroless) ─────────────────────────────────────────────
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/package.json

# Copy only production node_modules
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["/app/packages/server/dist/main.js"]
