# Stage 1: Build and bundle the TypeScript application
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm@8

# Set application directory
WORKDIR /app

# Add container marker
ENV MCP_CONTAINER=true

# Cache busting argument - changes this will invalidate all subsequent layers
ARG CACHEBUST=1

# 1) Copy ONLY manifests for dependency install (preserves cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/adapter-mock/package.json ./packages/adapter-mock/package.json
COPY packages/adapter-python/package.json ./packages/adapter-python/package.json

# 2) Install dependencies with workspace support using the lockfile
#    If lockfile is stale, this will fail (good signal to refresh it locally).
#    Copy all package sources to allow pnpm to resolve workspace:* links
COPY packages ./packages
RUN pnpm --version && pnpm install --frozen-lockfile --ignore-scripts

# 3) Copy the rest of the sources and build configs
COPY tsconfig.json ./
COPY packages/shared/tsconfig*.json ./packages/shared/
COPY packages/adapter-mock/tsconfig*.json ./packages/adapter-mock/
COPY packages/adapter-python/tsconfig*.json ./packages/adapter-python/

COPY src ./src
COPY scripts ./scripts/

# 4) Build workspace packages and main project (root build runs build:packages); then bundle
RUN pnpm run build --silent
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
COPY --from=builder /app/packages/adapter-python/dist/ /app/packages/adapter-python/dist/

# Create lightweight node_modules entries so adapters can resolve @debugmcp/* at runtime
RUN mkdir -p /app/node_modules/@debugmcp/shared \
  && mkdir -p /app/node_modules/@debugmcp/adapter-mock \
  && mkdir -p /app/node_modules/@debugmcp/adapter-python

# Copy package.json and dist for workspace packages into node_modules for resolution
COPY --from=builder /app/packages/shared/package.json /app/node_modules/@debugmcp/shared/package.json
COPY --from=builder /app/packages/shared/dist/ /app/node_modules/@debugmcp/shared/dist/

COPY --from=builder /app/packages/adapter-mock/package.json /app/node_modules/@debugmcp/adapter-mock/package.json
COPY --from=builder /app/packages/adapter-mock/dist/ /app/node_modules/@debugmcp/adapter-mock/dist/

COPY --from=builder /app/packages/adapter-python/package.json /app/node_modules/@debugmcp/adapter-python/package.json
COPY --from=builder /app/packages/adapter-python/dist/ /app/node_modules/@debugmcp/adapter-python/dist/

# Provide adapter/runtime Node deps from builder's node_modules
COPY --from=builder /app/node_modules/@vscode/debugprotocol /app/node_modules/@vscode/debugprotocol
COPY --from=builder /app/node_modules/which /app/node_modules/which
# which depends on isexe; include it to avoid MODULE_NOT_FOUND at runtime
COPY --from=builder /app/node_modules/isexe /app/node_modules/isexe

# Expose ports
EXPOSE 3000 5679

# Copy stdio silencer preloader into runtime image
COPY --from=builder /app/scripts/stdio-silencer.cjs /app/scripts/stdio-silencer.cjs
# Create an entrypoint wrapper that logs early startup context and preloads the silencer, then execs the server
RUN printf '#!/bin/sh\nmkdir -p /app/logs\n{\n  echo \"==== entry.sh ====\";\n  date;\n  echo \"argv: $*\";\n} >> /app/logs/entry.log 2>&1\nexec node --no-warnings -r /app/scripts/stdio-silencer.cjs dist/bundle.cjs \"$@\"\n' > /app/entry.sh && chmod +x /app/entry.sh

# Use the wrapper as entrypoint
ENTRYPOINT ["/app/entry.sh"]

# Default command arguments
CMD ["stdio"]
