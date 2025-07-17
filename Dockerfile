# Stage 1: Build and bundle the TypeScript application
FROM node:20-slim AS builder

# Set application directory
WORKDIR /app

# Add container marker
ENV MCP_CONTAINER=true

# Cache busting argument - changes this will invalidate all subsequent layers
ARG CACHEBUST=1

# Copy package files and install ALL dependencies (including dev)
COPY package.json package-lock.json ./
RUN npm ci --silent --ignore-scripts

# Copy source files
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts/

# Build TypeScript first
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

# Expose ports
EXPOSE 3000 5679

# Set the entrypoint to run the bundled application
ENTRYPOINT ["node", "dist/bundle.cjs"]

# Default command arguments
CMD ["stdio"]
