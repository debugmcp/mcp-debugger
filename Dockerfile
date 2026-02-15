# Stage 1: Build and bundle the TypeScript application
ARG DISABLE_LANGUAGES=rust

FROM node:20-slim AS builder
ARG DISABLE_LANGUAGES
ENV DEBUG_MCP_DISABLE_LANGUAGES=${DISABLE_LANGUAGES}

# Install pnpm (using version 10 to match local development)
RUN npm install -g pnpm@10

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
COPY packages/adapter-javascript/package.json ./packages/adapter-javascript/package.json
COPY packages/adapter-rust/package.json ./packages/adapter-rust/package.json
COPY packages/adapter-go/package.json ./packages/adapter-go/package.json

# 2) Install dependencies with workspace support using the lockfile
#    If lockfile is stale, this will fail (good signal to refresh it locally).
#    Copy all package sources to allow pnpm to resolve workspace:* links
COPY packages ./packages

# Remove any existing dist folders and tsbuildinfo artifacts from packages to prevent stale
# build outputs (and their cached path maps) from polluting the Docker build.
RUN set -eux; \
    for pkg in ./packages/*; do \
      [ -d "$pkg" ] || continue; \
      rm -rf "$pkg/dist" "$pkg/tsconfig.tsbuildinfo"; \
    done

RUN pnpm --version && pnpm install --frozen-lockfile --ignore-scripts

# 3) Copy the rest of the sources and build configs
COPY tsconfig*.json ./
COPY packages/shared/tsconfig*.json ./packages/shared/
COPY packages/adapter-mock/tsconfig*.json ./packages/adapter-mock/
COPY packages/adapter-python/tsconfig*.json ./packages/adapter-python/
COPY packages/adapter-javascript/tsconfig*.json ./packages/adapter-javascript/
COPY packages/adapter-rust/tsconfig*.json ./packages/adapter-rust/
COPY packages/adapter-go/tsconfig*.json ./packages/adapter-go/

COPY src ./src
COPY scripts ./scripts/

# 4) Build workspace packages and main project (root build runs build:packages); then bundle
# Download Linux CodeLLDB artifacts during the container build if they are not already vendored.
RUN CODELLDB_VENDOR_ALL=false CODELLDB_PLATFORMS=linux-x64 pnpm run build --silent
RUN node scripts/bundle.js

# Optional: quick diagnostics for bundle
RUN echo "=== Listing dist directory after bundling ===" && \
    ls -la dist/ && \
    echo "=== Checking for bundle.cjs ===" && \
    ls -la dist/bundle.cjs || true && \
    echo "=== Bundle size ===" && \
    (command -v du >/dev/null 2>&1 && du -h dist/bundle.cjs) || true

# 5) Ensure adapter packages are available in node_modules
# pnpm uses symlinks that don't survive Docker COPY, so we need to replace them with actual files
RUN rm -rf /app/node_modules/@debugmcp && \
    mkdir -p /app/node_modules/@debugmcp/shared && \
    mkdir -p /app/node_modules/@debugmcp/adapter-mock && \
    mkdir -p /app/node_modules/@debugmcp/adapter-python && \
    mkdir -p /app/node_modules/@debugmcp/adapter-javascript && \
    cp -r /app/packages/shared/dist /app/node_modules/@debugmcp/shared/ && \
    cp /app/packages/shared/package.json /app/node_modules/@debugmcp/shared/ && \
    cp -r /app/packages/adapter-mock/dist /app/node_modules/@debugmcp/adapter-mock/ && \
    cp /app/packages/adapter-mock/package.json /app/node_modules/@debugmcp/adapter-mock/ && \
    cp -r /app/packages/adapter-python/dist /app/node_modules/@debugmcp/adapter-python/ && \
    cp /app/packages/adapter-python/package.json /app/node_modules/@debugmcp/adapter-python/ && \
    cp -r /app/packages/adapter-javascript/dist /app/node_modules/@debugmcp/adapter-javascript/ && \
    cp -r /app/packages/adapter-javascript/vendor /app/node_modules/@debugmcp/adapter-javascript/ && \
    cp /app/packages/adapter-javascript/package.json /app/node_modules/@debugmcp/adapter-javascript/

# Stage 2: Create runtime image with full LLDB dependencies
FROM ubuntu:24.04
# Disable Go at runtime too — Delve isn't installed in the container
ENV DEBUG_MCP_DISABLE_LANGUAGES=rust,go

# Set application directory
WORKDIR /app

# Set container marker for runtime
ENV MCP_CONTAINER=true
# Set default workspace mount location (can be overridden at runtime)
ENV MCP_WORKSPACE_ROOT=/workspace

# Install Python, LLDB, and supporting tools (Node copied from builder)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      strace \
      procps \
      lsof \
      tini \
      python3 \
      python3-pip \
      python3-venv \
      libstdc++6 \
      lldb \
      python3-lldb && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    pip3 install --break-system-packages --no-cache-dir "debugpy>=1.8.14"

# Copy Node runtime from builder to avoid installing system-wide Node.js
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/bin/node /usr/bin/node

# Copy ONLY the bundled server and proxy files (everything else is bundled)
COPY --from=builder /app/dist/bundle.cjs /app/dist/bundle.cjs
COPY --from=builder /app/dist/proxy/proxy-bootstrap.js /app/dist/proxy/proxy-bootstrap.js
COPY --from=builder /app/dist/proxy/proxy-bundle.cjs /app/dist/proxy/proxy-bundle.cjs
COPY --from=builder /app/dist/proxy/utils /app/dist/proxy/utils

# Copy ONLY the runtime adapter packages (not entire node_modules)
# These are loaded dynamically at runtime via import()
COPY --from=builder /app/node_modules/@debugmcp /app/node_modules/@debugmcp

# Copy ONLY the production runtime dependencies needed by adapters
# Use a minimal set - the bundle already includes most dependencies
COPY --from=builder /app/node_modules/@vscode /app/node_modules/@vscode
COPY --from=builder /app/node_modules/which /app/node_modules/which
COPY --from=builder /app/node_modules/.pnpm/isexe@3.1.1/node_modules/isexe /app/node_modules/isexe

# Expose ports
EXPOSE 3000 5679

# Copy stdio silencer preloader into runtime image
COPY --from=builder /app/scripts/stdio-silencer.cjs /app/scripts/stdio-silencer.cjs

# Create logs directory with proper permissions for any user
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Create an entrypoint wrapper that logs early startup context and preloads the silencer, then execs the server
RUN printf '#!/bin/sh\n# Log directory already exists with proper permissions\n{\n  echo \"==== entry.sh ====\";\n  date;\n  echo \"argv: $*\";\n} >> /app/logs/entry.log 2>&1\nexport MCP_WORKSPACE_ROOT="${MCP_WORKSPACE_ROOT:-/workspace}"\nexec node --no-warnings -r /app/scripts/stdio-silencer.cjs dist/bundle.cjs \"$@\"\n' > /app/entry.sh && chmod +x /app/entry.sh

# Use tini as PID1 to properly handle signals, then run our wrapper
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entry.sh"]

# Default command arguments
CMD ["stdio"]
