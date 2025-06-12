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

# Copy the project
COPY . .

# Install npm dependencies
RUN npm ci

# Build the project
RUN npm run build

# Run the e2e test that was failing with DAP timeout
CMD ["npm", "test", "tests/e2e/debugpy-connection.test.ts"]
