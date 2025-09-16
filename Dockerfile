# Stage 1: Build and bundle the TypeScript application
FROM node:20-slim AS builder

# Set application directory
WORKDIR /app

# Add container marker
ENV MCP_CONTAINER=true

# Cache busting argument - changes this will invalidate all subsequent layers
ARG CACHEBUST=1

# Copy workspace configuration and package files
COPY package.json package-lock.json ./
COPY packages/shared/package*.json ./packages/shared/

# Install ALL dependencies (respects workspace configuration)
RUN npm ci --silent --ignore-scripts

# Copy TypeScript configurations
COPY tsconfig.json ./
COPY packages/shared/tsconfig*.json ./packages/shared/

# Copy source files
COPY src ./src
COPY packages/shared/src ./packages/shared/src
COPY scripts ./scripts/

# Build shared package first (it's a dependency)
RUN npm run build -w @debugmcp/shared --silent

# Build TypeScript main package
RUN npm run build --silent

# Bundle the application into a single file
RUN node scripts/bundle.js

# Debug: List files after bundling to ensure bundle.cjs exists
RUN echo "=== Listing dist directory after bundling ===" && \
    ls -la dist/ && \
    echo "=== Checking for bundle.cjs ===" && \
    ls -la dist/bundle.cjs && \
    echo "=== Bundle size ===" && \
    du -h dist/bundle.cjs

# Stage 2: Create minimal runtime image
FROM python:3.11-alpine

# Set application directory
WORKDIR /app

# Set container marker for runtime
ENV MCP_CONTAINER=true

# Install only Node.js runtime (no npm) and Python deps
RUN apk add --no-cache nodejs && \
    pip3 install --no-cache-dir debugpy>=1.8.14

# Copy the bundled application, all dist files for proxy dependencies, and package.json
COPY --from=builder /app/dist/ /app/dist/
COPY --from=builder /app/package.json /app/package.json

# Copy packages for potential runtime references (workspace symlinks)
COPY --from=builder /app/packages/shared/dist/ /app/packages/shared/dist/

# Expose ports
EXPOSE 3000 5679

# Set the entrypoint to run the bundled application
ENTRYPOINT ["node", "dist/bundle.cjs"]

# Default command arguments
CMD ["stdio"]
