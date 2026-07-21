FROM node:26-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS node-base

FROM ubuntu:26.04@sha256:b7f48194d4d8b763a478a621cdc81c27be222ba2206ca3ca6bc42b49685f3d9e

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

# Install debugpy (hash-pinned)
COPY requirements/debugpy.txt /tmp/debugpy-requirements.txt
RUN pip3 install --require-hashes -r /tmp/debugpy-requirements.txt && rm /tmp/debugpy-requirements.txt

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
