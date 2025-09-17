# Stage 1: Build and bundle the TypeScript application
FROM node:20-slim AS builder

# Set application directory
WORKDIR /app

# Add container marker
ENV MCP_CONTAINER=true

# Cache busting argument - changes this will invalidate all subsequent layers
ARG CACHEBUST=1

# 1) Copy ONLY manifests for dependency install (preserves cache)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/adapter-mock/package.json ./packages/adapter-mock/package.json

# 2) Install dependencies with workspace support using the lockfile
#    If lockfile is stale, this will fail (good signal to refresh it locally).
#    Copy all package sources to allow npm to resolve workspace:* links
COPY packages ./packages
RUN npm --version && npm ci --ignore-scripts

# 3) Copy the rest of the sources and build configs
COPY tsconfig.json ./
COPY packages/shared/tsconfig*.json ./packages/shared/
COPY packages/adapter-mock/tsconfig*.json ./packages/adapter-mock/

COPY src ./src
COPY scripts ./scripts/

# 4) Build workspace packages (shared first), then main project; then bundle
RUN npm run build -w @debugmcp/shared --silent
RUN npm run build --silent
RUN node scripts/bundle.js

# Optional: quick diagnostics for bundle
RUN echo "=== Listing dist directory after bundling ===" && \
    ls -la dist/ && \
    echo "=== Checking for bundle.cjs ===" && \
    ls -la dist/bundle.cjs || true && \
    echo "=== Bundle size ===" && \
    (command -v du >/dev/null 2>&1 && du -h dist/bundle.cjs) || true

# Stage 2: Create minimal runtime image
FROM python:3.11-alpine

# Set application directory
WORKDIR /app

# Set container marker for runtime
ENV MCP_CONTAINER=true

# Install only Node.js runtime (no npm) and Python deps
RUN apk add --no-cache nodejs && \
    pip3 install --no-cache-dir "debugpy>=1.8.14"

# Copy the bundled application, all dist files for proxy dependencies, and package.json
COPY --from=builder /app/dist/ /app/dist/
COPY --from=builder /app/package.json /app/package.json

# Copy packages for potential runtime references (workspace symlinks / dist artifacts)
COPY --from=builder /app/packages/shared/dist/ /app/packages/shared/dist/
COPY --from=builder /app/packages/adapter-mock/dist/ /app/packages/adapter-mock/dist/

# Expose ports
EXPOSE 3000 5679

# Set the entrypoint to run the bundled application
ENTRYPOINT ["node", "dist/bundle.cjs"]

# Default command arguments
CMD ["stdio"]
