#!/bin/bash
# Script to test MCP server integration
# Tests the server's JSON-RPC protocol compliance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Testing mcp-debugger MCP integration..."
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local input_json="$2"
    local expected_pattern="$3"

    echo -n "Testing $test_name... "

    local output
    output=$(echo "$input_json" | timeout 2 node "$PROJECT_DIR/dist/index.js" stdio 2>&1 || true)

    if echo "$output" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Expected pattern: $expected_pattern"
        echo "  Got output: $output"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Initialize request
run_test "initialize" \
    '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"roots":{},"sampling":{}},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' \
    '"result".*"protocolVersion".*"2024-11-05"'

# Test 2: Clean output (no logs)
echo -n "Testing clean output (no logs)... "
output=$(echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"roots":{},"sampling":{}},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | timeout 1 node "$PROJECT_DIR/dist/index.js" stdio 2>&1)
# Check that output is valid JSON and contains no log timestamps
if echo "$output" | python3 -m json.tool > /dev/null 2>&1 && ! echo "$output" | grep -q "^\[.*\]"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Output contains non-JSON content or logs"
    ((TESTS_FAILED++))
fi

# Test 3: Tools list
run_test "tools/list" \
    '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}' \
    '"tools".*"create_debug_session"'

# Test 4: Without stdio argument (should auto-detect)
echo -n "Testing auto-detection (no stdio arg)... "
output=$(echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"roots":{},"sampling":{}},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | timeout 2 node "$PROJECT_DIR/dist/index.js" 2>&1)
if echo "$output" | python3 -m json.tool > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC}"
    echo "  Auto-detection may not be working, explicit stdio argument required"
fi

# Test 5: Claude CLI integration
echo -n "Testing Claude CLI integration... "
if /home/ubuntu/.claude/local/claude mcp list 2>/dev/null | grep -q "mcp-debugger"; then
    if /home/ubuntu/.claude/local/claude mcp list 2>/dev/null | grep -q "mcp-debugger.*✓ Connected"; then
        echo -e "${GREEN}✓ PASSED${NC} (Connected)"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠ WARNING${NC} (Configured but not connected - restart Claude Code)"
    fi
else
    echo -e "${RED}✗ FAILED${NC} (Not configured)"
    echo "  Run: $PROJECT_DIR/scripts/install-claude-mcp.sh"
    ((TESTS_FAILED++))
fi

# Summary
echo ""
echo "========================================"
echo "Test Results:"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
else
    echo -e "Failed: 0"
fi

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed! MCP integration is working correctly.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
    exit 1
fi