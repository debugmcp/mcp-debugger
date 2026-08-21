# Stage 1: Build and bundle the TypeScript application
# All adapters build; runtime availability is governed by the stage-2
# DEBUG_MCP_DISABLE_LANGUAGES value (issue #328).
ARG DISABLE_LANGUAGES=

FROM node:26-slim@sha256:deae974a69e140f44f434ab29cb519fb5f8fe250fd364b8ca446bd0761acdc6a AS builder
ARG DISABLE_LANGUAGES
ENV DEBUG_MCP_DISABLE_LANGUAGES=${DISABLE_LANGUAGES}

# Install pnpm via corepack (version 10 to match local development).
# node:26-slim no longer bundles corepack, so install it explicitly (pinned,
# matching the rest of this Dockerfile's exact-version pins) before enabling;
# the activated pnpm version is still integrity-checked against the spec.
RUN npm install -g corepack@0.35.0 && corepack enable && corepack prepare pnpm@10.33.0 --activate

# Set application directory
WORKDIR /app

# Add container marker
ENV MCP_CONTAINER=true

# Cache busting argument - changes this will invalidate all subsequent layers
ARG CACHEBUST=1

# 1) Copy ONLY manifests for dependency install (preserves cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/codelldb-common/package.json ./packages/codelldb-common/package.json
COPY packages/adapter-mock/package.json ./packages/adapter-mock/package.json
COPY packages/adapter-python/package.json ./packages/adapter-python/package.json
COPY packages/adapter-javascript/package.json ./packages/adapter-javascript/package.json
COPY packages/adapter-rust/package.json ./packages/adapter-rust/package.json
COPY packages/adapter-go/package.json ./packages/adapter-go/package.json
COPY packages/adapter-java/package.json ./packages/adapter-java/package.json
COPY packages/adapter-ruby/package.json ./packages/adapter-ruby/package.json
COPY packages/adapter-dotnet/package.json ./packages/adapter-dotnet/package.json
COPY packages/adapter-cpp/package.json ./packages/adapter-cpp/package.json

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
COPY packages/codelldb-common/tsconfig*.json ./packages/codelldb-common/
COPY packages/adapter-mock/tsconfig*.json ./packages/adapter-mock/
COPY packages/adapter-python/tsconfig*.json ./packages/adapter-python/
COPY packages/adapter-javascript/tsconfig*.json ./packages/adapter-javascript/
COPY packages/adapter-rust/tsconfig*.json ./packages/adapter-rust/
COPY packages/adapter-go/tsconfig*.json ./packages/adapter-go/
COPY packages/adapter-java/tsconfig*.json ./packages/adapter-java/
COPY packages/adapter-ruby/tsconfig*.json ./packages/adapter-ruby/
COPY packages/adapter-dotnet/tsconfig*.json ./packages/adapter-dotnet/
COPY packages/adapter-cpp/tsconfig*.json ./packages/adapter-cpp/

COPY src ./src
COPY scripts ./scripts/

# 4) Vendor the CodeLLDB engine for this image's architecture (rust + cpp adapters).
# This MUST be explicit: the root postinstall that vendors on dev machines is
# skipped by --ignore-scripts, and codelldb-common's package build is tsc-only —
# without this step a fresh CI context ships an image with no CodeLLDB (#387;
# the committed vendor/.gitkeep kept the later cp -r from failing, so v0.24.0
# shipped silently broken). Implemented in plain shell (curl + sha256sum +
# unzip) because the node vendor script dies mid-extraction with exit 0 under
# buildkit (#389); the download is verified against the pinned SHA-256 digests
# in packages/codelldb-common/vendor-manifest.json. A "current" symlink gives
# the runtime stage an architecture-independent CODELLDB_PATH. If the build
# context already carries a vendored engine (local dev builds), it is reused.
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in arm64) CODELLDB_ARCH=linux-arm64;; *) CODELLDB_ARCH=linux-x64;; esac; \
    DEST="/app/packages/codelldb-common/vendor/codelldb/${CODELLDB_ARCH}"; \
    if [ ! -x "$DEST/adapter/codelldb" ]; then \
      apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip && rm -rf /var/lib/apt/lists/*; \
      MANIFEST=/app/packages/codelldb-common/vendor-manifest.json; \
      CODELLDB_VERSION="$(node -p "require('$MANIFEST').codelldb.version")"; \
      EXPECTED_SHA="$(node -p "require('$MANIFEST').codelldb.assets['codelldb-${CODELLDB_ARCH}.vsix']")"; \
      curl -fsSL --retry 3 -o /tmp/codelldb.vsix "https://github.com/vadimcn/codelldb/releases/download/v${CODELLDB_VERSION}/codelldb-${CODELLDB_ARCH}.vsix"; \
      echo "${EXPECTED_SHA}  /tmp/codelldb.vsix" | sha256sum -c -; \
      unzip -q /tmp/codelldb.vsix -d /tmp/codelldb-extract; \
      rm -rf "$DEST"; mkdir -p "$DEST"; \
      cp -r /tmp/codelldb-extract/extension/adapter "$DEST/adapter"; \
      cp -r /tmp/codelldb-extract/extension/lldb "$DEST/lldb"; \
      if [ -d /tmp/codelldb-extract/extension/lang_support ]; then cp -r /tmp/codelldb-extract/extension/lang_support "$DEST/lang_support"; fi; \
      chmod 755 "$DEST/adapter/codelldb"; \
      printf '{\n  "version": "%s",\n  "platform": "%s"\n}\n' "$CODELLDB_VERSION" "$CODELLDB_ARCH" > "$DEST/version.json"; \
      rm -rf /tmp/codelldb.vsix /tmp/codelldb-extract; \
    fi; \
    test -x "$DEST/adapter/codelldb"; \
    ln -sfn "$CODELLDB_ARCH" /app/packages/codelldb-common/vendor/codelldb/current

# 5) Build workspace packages and main project (root build runs build:packages); then bundle.
# The node vendor script runs via prebuild -> vendor:adapters; without this env it
# would default to all five platforms and re-download the win32/darwin payloads the
# .dockerignore deliberately excludes (~450 MB the Linux image never uses, and a
# needless network dependency that can fail the build). Host-only mode finds the
# shell-vendored engine above already fresh and downloads nothing.
ENV CODELLDB_VENDOR_ALL=false
RUN pnpm run build --silent
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
    cp /app/packages/adapter-javascript/package.json /app/node_modules/@debugmcp/adapter-javascript/ && \
    mkdir -p /app/node_modules/@debugmcp/adapter-java && \
    cp -r /app/packages/adapter-java/dist /app/node_modules/@debugmcp/adapter-java/ && \
    cp -r /app/packages/adapter-java/java /app/node_modules/@debugmcp/adapter-java/ && \
    cp /app/packages/adapter-java/package.json /app/node_modules/@debugmcp/adapter-java/ && \
    mkdir -p /app/node_modules/@debugmcp/adapter-ruby && \
    cp -r /app/packages/adapter-ruby/dist /app/node_modules/@debugmcp/adapter-ruby/ && \
    cp /app/packages/adapter-ruby/package.json /app/node_modules/@debugmcp/adapter-ruby/ && \
    mkdir -p /app/node_modules/@debugmcp/codelldb-common && \
    cp -r /app/packages/codelldb-common/dist /app/node_modules/@debugmcp/codelldb-common/ && \
    cp -r /app/packages/codelldb-common/vendor /app/node_modules/@debugmcp/codelldb-common/ && \
    cp /app/packages/codelldb-common/package.json /app/node_modules/@debugmcp/codelldb-common/ && \
    mkdir -p /app/node_modules/@debugmcp/adapter-cpp && \
    cp -r /app/packages/adapter-cpp/dist /app/node_modules/@debugmcp/adapter-cpp/ && \
    cp /app/packages/adapter-cpp/package.json /app/node_modules/@debugmcp/adapter-cpp/ && \
    mkdir -p /app/node_modules/@debugmcp/adapter-rust && \
    cp -r /app/packages/adapter-rust/dist /app/node_modules/@debugmcp/adapter-rust/ && \
    cp /app/packages/adapter-rust/package.json /app/node_modules/@debugmcp/adapter-rust/

# Stage 2: Create runtime image with full LLDB dependencies
FROM ubuntu:26.04@sha256:678c6550cc43645e08669028bc177f50be4e7c5b8cca677067b1914d4afc7a03
# Disabled languages: go has no attach implementation and no Delve here,
# dotnet has no netcoredbg here. Ruby is intentionally present but attach-only
# (adapter shipped, no Ruby runtime — attach connects directly to a remote
# rdbg socket, issue #331). rust and cpp are enabled with vendored CodeLLDB
# (#328) — sound for Linux-compiled binaries; host-compiled (Windows/macOS)
# binaries mounted into the container are not debuggable by container LLDB.
ENV DEBUG_MCP_DISABLE_LANGUAGES=go,dotnet

# Set application directory
WORKDIR /app

# Set container marker for runtime
ENV MCP_CONTAINER=true
# Set default workspace mount location (can be overridden at runtime)
ENV MCP_WORKSPACE_ROOT=/workspace

# Install Python, LLDB, and supporting tools (Node copied from builder)
COPY requirements/debugpy.txt /tmp/debugpy-requirements.txt
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
      libatomic1 \
      lldb \
      python3-lldb \
      g++ \
      openjdk-21-jdk-headless && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    pip3 install --break-system-packages --no-cache-dir --require-hashes -r /tmp/debugpy-requirements.txt && \
    rm /tmp/debugpy-requirements.txt

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

# Single shared CodeLLDB copy for the rust and cpp adapters (issue #328).
# Both adapters probe their own package roots first (dead in this image) and
# fall back to CODELLDB_PATH; the sibling lldb/ tree next to the binary
# supplies liblldb and the Python support files. "current" is a symlink to
# this image's architecture dir, created in the builder stage.
ENV CODELLDB_PATH=/app/node_modules/@debugmcp/codelldb-common/vendor/codelldb/current/adapter/codelldb

# Fail the image build if the debug engine is missing — the v0.24.0 image
# shipped without CodeLLDB because nothing guarded this (#387).
RUN test -x "$CODELLDB_PATH"

# Pre-compile JDI bridge for instant Java debugging (no on-demand compilation at runtime)
RUN mkdir -p /app/node_modules/@debugmcp/adapter-java/java/out && \
    javac --release 21 \
      /app/node_modules/@debugmcp/adapter-java/java/JdiDapServer.java \
      -d /app/node_modules/@debugmcp/adapter-java/java/out

# Copy ONLY the production runtime dependencies needed by adapters
# Use a minimal set - the bundle already includes most dependencies
COPY --from=builder /app/node_modules/@vscode /app/node_modules/@vscode
COPY --from=builder /app/node_modules/which /app/node_modules/which
COPY --from=builder /app/node_modules/.pnpm/isexe@4.0.0/node_modules/isexe /app/node_modules/isexe

# Expose ports
EXPOSE 3000 5679

# Copy stdio silencer preloader into runtime image
COPY --from=builder /app/scripts/stdio-silencer.cjs /app/scripts/stdio-silencer.cjs

# Create logs directory with proper permissions for any user, and an empty
# workspace mount point so volume-less runs (e.g. kubectl debug ephemeral
# containers, issue #332) have a valid MCP_WORKSPACE_ROOT directory.
RUN mkdir -p /app/logs /workspace && chmod 777 /app/logs

# Copy entrypoint wrapper (version-controlled script avoids shell quoting pitfalls)
COPY scripts/docker-entry.sh /app/entry.sh
RUN sed -i 's/\r$//' /app/entry.sh && chmod +x /app/entry.sh

# Use tini as PID1 to properly handle signals, then run our wrapper
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entry.sh"]

# Default command arguments
CMD ["stdio"]
