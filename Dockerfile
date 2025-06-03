# Stage 1: Build the TypeScript application
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
# npm ci installs based on package-lock.json, good for reproducible builds
# Using --only=production might be too aggressive if build scripts need devDependencies
# but --ignore-scripts is fine. If build needs devDeps, remove --only=production
RUN npm ci --ignore-scripts

# Copy tsconfig and source code
COPY tsconfig.json ./
COPY src ./src

# Build the project (outputs to /app/dist)
RUN npm run build

# Stage 2: Create the final lightweight image
FROM python:3.11-slim

WORKDIR /app

# Install Node.js and debugpy
RUN apt-get update && \
    apt-get install -y --no-install-recommends nodejs npm python3-pip && \
    pip3 install --no-cache-dir debugpy>=1.8.14 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy built application from the builder stage
COPY --from=builder /app/dist ./dist

# Copy package.json for metadata and potentially runtime non-dev dependencies
# If there are runtime JS dependencies not bundled into dist, they might need npm install --only=production here
# For now, assuming 'dist' is self-contained or only needs Node.js runtime.
COPY package.json .

# Add OCI labels
# LABEL org.opencontainers.image.source="https://github.com/your-repo/debug-mcp-server" \
#       org.opencontainers.image.version="0.1.0" \
#       org.opencontainers.image.description="Run-time step-through debugging for LLM agents. MCP server for Python debugging via DAP (debugpy)."

# The entrypoint will be node /app/dist/index.js.
# If the server needs to access files relative to the project root (e.g. examples, tests),
# those would need to be copied as well. For now, only copying 'dist' and 'package.json'.

# Expose the default MCP port (e.g., 3000 from package.json start script, or as configured)
# Expose the default debugpy attach port (5679, as per E-1, though debugpy can listen on any)
EXPOSE 3000 5679

# Set the entrypoint to run the Node.js application
# Note: /app is the WORKDIR
ENTRYPOINT ["node", "dist/index.js"]

# Default command arguments (can be overridden)
# Example: CMD ["http", "--port", "3000", "--log-level", "info"]
# These are passed to `node dist/index.js <args>`
# For now, let the server use its defaults or be configured by env vars if possible.
