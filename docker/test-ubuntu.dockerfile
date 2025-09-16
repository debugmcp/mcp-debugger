FROM ubuntu:22.04

# Install Node.js and Python
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    git \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install debugpy
RUN pip3 install debugpy

# Set working directory
WORKDIR /app

# Copy workspace configuration and package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY vitest.workspace.ts ./
COPY tsconfig*.json ./
COPY packages/shared/tsconfig*.json ./packages/shared/

# Copy all source and test files
COPY . .

# Install npm dependencies (respects workspace configuration)
RUN npm ci

# Build shared package first
RUN npm run build -w @debugmcp/shared

# Build the main project
RUN npm run build

# Run the e2e test that was failing with DAP timeout
CMD ["npm", "test", "tests/e2e/debugpy-connection.test.ts"]
