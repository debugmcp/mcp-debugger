FROM node:20-slim@sha256:f93745c153377ee2fbbdd6e24efcd03cd2e86d6ab1d8aa9916a3790c40313a55 AS node-base

FROM ubuntu:22.04@sha256:eb29ed27b0821dca09c2e28b39135e185fc1302036427d5f4d70a41ce8fd7659

# Copy Node.js from official image (avoids curl|bash install pattern)
COPY --from=node-base /usr/local/bin/node /usr/local/bin/node
COPY --from=node-base /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=node-base /usr/local/bin/npm /usr/local/bin/npm
COPY --from=node-base /usr/local/bin/npx /usr/local/bin/npx
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Install Python and supporting tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install debugpy (pinned version)
RUN pip3 install "debugpy==1.8.14"

# Set working directory
WORKDIR /app

# Copy workspace configuration and package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/adapter-mock/package*.json ./packages/adapter-mock/
COPY packages/adapter-python/package*.json ./packages/adapter-python/
COPY vitest.workspace.ts ./
COPY tsconfig*.json ./
COPY packages/shared/tsconfig*.json ./packages/shared/
COPY packages/adapter-mock/tsconfig*.json ./packages/adapter-mock/
COPY packages/adapter-python/tsconfig*.json ./packages/adapter-python/

# Copy all source and test files
COPY . .

# Install npm dependencies (respects workspace configuration)
RUN npm ci

# Build all packages and the main project (root build runs build:packages)
RUN npm run build

# Run the e2e test that was failing with DAP timeout
CMD ["npm", "test", "tests/e2e/debugpy-connection.test.ts"]
