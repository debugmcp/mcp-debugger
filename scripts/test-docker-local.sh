#!/bin/bash

# Docker Smoke Test Runner
# Runs the Docker smoke tests locally to verify containerized debugging

set -e

echo "====================================="
echo "  Docker Smoke Test Runner"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Check if Docker is running
echo "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Build the project first
echo "Building the project..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Build the Docker image
echo "Building Docker image..."
docker build -t mcp-debugger:test .
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker image built${NC}"
echo ""

# Clean up any existing test containers
echo "Cleaning up old test containers..."
docker ps -a | grep mcp-debugger-test | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Run the tests
echo "====================================="
echo "  Running Docker Smoke Tests"
echo "====================================="
echo ""

# Track test results
PYTHON_RESULT=0
JS_RESULT=0

# Run Python tests
echo -e "${YELLOW}Running Python Docker tests...${NC}"
echo "-------------------------------------"
npx vitest run tests/e2e/docker/docker-smoke-python.test.ts --reporter=verbose
PYTHON_RESULT=$?
echo ""

# Run JavaScript tests
echo -e "${YELLOW}Running JavaScript Docker tests...${NC}"
echo "-------------------------------------"
npx vitest run tests/e2e/docker/docker-smoke-javascript.test.ts --reporter=verbose
JS_RESULT=$?
echo ""

# Summary
echo "====================================="
echo "  Test Results Summary"
echo "====================================="
echo ""

if [ $PYTHON_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Python Docker tests: PASSED${NC}"
else
    echo -e "${RED}❌ Python Docker tests: FAILED${NC}"
fi

if [ $JS_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ JavaScript Docker tests: PASSED${NC}"
else
    echo -e "${RED}❌ JavaScript Docker tests: FAILED${NC}"
    echo -e "${YELLOW}   (This is expected - JavaScript debugging in Docker has a known regression)${NC}"
fi

echo ""
echo "====================================="

# Expected state before fix:
# - Python should PASS
# - JavaScript should FAIL
# This confirms our tests are working properly

if [ $PYTHON_RESULT -eq 0 ] && [ $JS_RESULT -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Tests are in expected state: Python works, JavaScript has known regression${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Fix JavaScript adapter for Docker environment"
    echo "2. Run this script again - both should pass after fix"
    exit 0
elif [ $PYTHON_RESULT -eq 0 ] && [ $JS_RESULT -eq 0 ]; then
    echo -e "${GREEN}🎉 All Docker tests passed! The regression has been fixed.${NC}"
    exit 0
else
    echo -e "${RED}❌ Unexpected test results - please investigate${NC}"
    exit 1
fi
